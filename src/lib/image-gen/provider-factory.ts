/**
 * Image Generation Provider Factory
 *
 * Orchestrates image generation across providers:
 * - Provider selection based on style/config
 * - Prompt enhancement for better results
 * - Image processing and optimization
 * - Storage in thread_outputs table
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getToolConfig } from '@/lib/db/tool-config';
import { execute, queryOne } from '@/lib/db/index';
import { getRequestContext } from '@/lib/request-context';
import { generateWithDalle } from './providers/openai-dalle';
import { generateWithGemini } from './providers/gemini-imagen';
import { processImage, getFileExtension } from './image-processor';
import type {
  ImageGenConfig,
  ImageGenToolArgs,
  ImageProvider,
  ImageStyle,
  GeneratedImage,
  ImageGenResponse,
  ImageHint,
  ProcessingOptions,
} from '@/types/image-gen';

// ===== Configuration =====

/**
 * Default configuration for image_gen tool
 */
export const IMAGE_GEN_DEFAULTS: ImageGenConfig = {
  activeProvider: 'gemini',
  providers: {
    openai: {
      enabled: true,
      model: 'dall-e-3',
      size: '1024x1024',
      quality: 'standard',
      style: 'natural',
    },
    gemini: {
      enabled: true,
      model: 'gemini-3-pro-image-preview',
      aspectRatio: '16:9',
    },
  },
  defaultStyle: 'infographic',
  infographicProvider: 'gemini',
  enhancePrompts: true,
  addSafetyPrefixes: true,
  imageProcessing: {
    maxDimension: 2048,
    format: 'webp',
    quality: 85,
    generateThumbnail: true,
    thumbnailSize: 400,
  },
};

/**
 * Get image generation configuration from database
 */
export function getImageGenConfig(): ImageGenConfig {
  const config = getToolConfig('image_gen');

  if (config?.config) {
    // Merge with defaults to ensure all fields exist
    const stored = config.config as Partial<ImageGenConfig>;
    return {
      ...IMAGE_GEN_DEFAULTS,
      ...stored,
      providers: {
        openai: { ...IMAGE_GEN_DEFAULTS.providers.openai, ...stored.providers?.openai },
        gemini: { ...IMAGE_GEN_DEFAULTS.providers.gemini, ...stored.providers?.gemini },
      },
      imageProcessing: {
        ...IMAGE_GEN_DEFAULTS.imageProcessing,
        ...stored.imageProcessing,
      },
    };
  }

  return IMAGE_GEN_DEFAULTS;
}

/**
 * Check if image generation is enabled
 */
export function isImageGenEnabled(): boolean {
  const config = getToolConfig('image_gen');
  return config?.isEnabled ?? false;
}

// ===== Provider Selection =====

/**
 * Select the best provider for the request
 *
 * Priority:
 * 1. Explicit request (args.provider)
 * 2. Style-based recommendation (infographic → gemini)
 * 3. Admin configured default (activeProvider)
 * 4. Any enabled provider
 */
function selectProvider(
  args: ImageGenToolArgs,
  config: ImageGenConfig
): ImageProvider {
  // 1. Explicit override from LLM
  if (args.provider && config.providers[args.provider]?.enabled) {
    return args.provider;
  }

  // 2. Style-based recommendation
  const style = args.style || config.defaultStyle;
  if (isInfographicStyle(style)) {
    // Gemini Nano Banana Pro excels at infographics with text
    if (config.providers.gemini.enabled) {
      return 'gemini';
    }
  }

  // 3. Use configured default
  if (config.activeProvider !== 'none') {
    const provider = config.activeProvider as ImageProvider;
    if (config.providers[provider]?.enabled) {
      return provider;
    }
  }

  // 4. Fallback to any enabled provider
  if (config.providers.openai.enabled) return 'openai';
  if (config.providers.gemini.enabled) return 'gemini';

  throw new Error('No image generation provider is enabled');
}

/**
 * Check if style benefits from infographic-optimized provider
 */
function isInfographicStyle(style: ImageStyle): boolean {
  return ['infographic', 'diagram', 'chart', 'process-flow'].includes(style);
}

// ===== Prompt Enhancement =====

/**
 * Enhance prompt based on style for better results
 */
function enhancePrompt(
  args: ImageGenToolArgs,
  config: ImageGenConfig
): string {
  if (!config.enhancePrompts) {
    return args.prompt;
  }

  let enhanced = args.prompt;
  const style = args.style || config.defaultStyle;

  // Add style-specific prefixes
  switch (style) {
    case 'infographic':
      enhanced = `Create a professional infographic: ${enhanced}
Style: Modern, clean, professional business design.
Requirements: Legible text, clear data visualization, balanced layout, high contrast for readability.
Colors: Professional color scheme suitable for business presentations.`;
      break;

    case 'diagram':
      enhanced = `Create a clear technical diagram: ${enhanced}
Style: Technical, clean lines, labeled components.
Requirements: Easy to understand, logical flow, professional appearance, clear labels.`;
      break;

    case 'process-flow':
      enhanced = `Create a process flow diagram: ${enhanced}
Style: Clean flowchart with connected steps.
Requirements: Clear directional arrows, numbered steps, readable labels, logical progression.`;
      break;

    case 'chart':
      enhanced = `Create a data visualization chart: ${enhanced}
Style: Modern chart design with clear labels and legend.
Requirements: Accurate data representation, clean layout, professional colors.`;
      break;

    case 'illustration':
      enhanced = `Create a professional illustration: ${enhanced}
Style: Clean, modern illustration suitable for presentations and documents.`;
      break;

    case 'photo':
      enhanced = `Create a photorealistic image: ${enhanced}
Style: High-quality, professional photography style with proper lighting and composition.`;
      break;

    case 'icon':
      enhanced = `Create a simple icon: ${enhanced}
Style: Minimal, clean, recognizable at small sizes, flat design.`;
      break;
  }

  // Add safety prefix if configured
  if (config.addSafetyPrefixes) {
    enhanced = `Professional, workplace-appropriate image. ${enhanced}`;
  }

  return enhanced;
}

// ===== Storage =====

/**
 * Get output directory for generated images
 * Uses same location as document generator
 */
function getOutputDirectory(): string {
  const outputDir =
    process.env.DOC_OUTPUT_DIR || path.join(process.cwd(), 'data', 'outputs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

/**
 * Save image to disk and database
 */
async function saveImage(
  buffer: Buffer,
  thumbnailBuffer: Buffer | undefined,
  args: ImageGenToolArgs,
  provider: ImageProvider,
  model: string,
  config: ImageGenConfig,
  metadata: {
    width: number;
    height: number;
    format: string;
    sizeBytes: number;
    enhancedPrompt?: string;
    revisedPrompt?: string;
    generationTimeMs: number;
  }
): Promise<GeneratedImage> {
  const imageId = uuidv4();
  const outputDir = getOutputDirectory();

  // Save main image
  const extension = getFileExtension(config.imageProcessing.format);
  const filename = `${imageId}.${extension}`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, buffer);

  // Save thumbnail if available
  let thumbnailFilename: string | undefined;
  if (thumbnailBuffer) {
    thumbnailFilename = `${imageId}_thumb.webp`;
    const thumbnailPath = path.join(outputDir, thumbnailFilename);
    fs.writeFileSync(thumbnailPath, thumbnailBuffer);
  }

  // Get thread context for foreign key constraint
  const context = getRequestContext();
  const threadId = context.threadId;

  if (!threadId) {
    throw new Error('No thread context available for image generation');
  }

  // Check if this is a main chat thread or workspace thread/session
  // Main chat uses 'threads' table, workspace uses 'workspace_threads' or session ID
  const mainThreadExists = queryOne<{ id: string }>('SELECT id FROM threads WHERE id = ?', [threadId]);
  const workspaceThread = queryOne<{ id: string; workspace_id: string; session_id: string }>(
    'SELECT id, workspace_id, session_id FROM workspace_threads WHERE id = ?',
    [threadId]
  );
  const workspaceSession = queryOne<{ id: string; workspace_id: string }>(
    'SELECT id, workspace_id FROM workspace_sessions WHERE id = ?',
    [threadId]
  );

  const isWorkspaceContext = workspaceThread || workspaceSession;

  if (!mainThreadExists && !isWorkspaceContext) {
    console.error('[ImageGen] Thread not found in database:', { threadId, context });
    throw new Error(`Thread ${threadId} not found - cannot save generated image`);
  }

  const generationConfig = JSON.stringify({
    provider,
    model,
    prompt: args.prompt,
    enhancedPrompt: metadata.enhancedPrompt,
    revisedPrompt: metadata.revisedPrompt,
    style: args.style,
    aspectRatio: args.aspectRatio,
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    generationTimeMs: metadata.generationTimeMs,
    thumbnailFilename,
  });

  // Store in appropriate database table based on context
  let result;
  let downloadUrlPrefix: string;

  try {
    if (isWorkspaceContext) {
      // Workspace context - use workspace_outputs table
      const workspaceId = workspaceThread?.workspace_id || workspaceSession?.workspace_id;
      const sessionId = workspaceThread?.session_id || workspaceSession?.id;
      const actualThreadId = workspaceThread?.id || null;

      result = execute(
        `INSERT INTO workspace_outputs (
          workspace_id, session_id, thread_id, filename, filepath, file_type, file_size,
          generation_config, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          workspaceId,
          sessionId,
          actualThreadId,
          filename,
          filepath,
          'image', // file_type
          metadata.sizeBytes,
          generationConfig,
          null, // expires_at (images don't expire by default)
        ]
      );
      downloadUrlPrefix = '/api/workspace-documents';
    } else {
      // Main chat context - use thread_outputs table
      result = execute(
        `INSERT INTO thread_outputs (
          thread_id, message_id, filename, filepath, file_type, file_size,
          generation_config, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          threadId,
          null, // message_id
          filename,
          filepath,
          'image', // file_type
          metadata.sizeBytes,
          generationConfig,
          null, // expires_at (images don't expire by default)
        ]
      );
      downloadUrlPrefix = '/api/documents';
    }
  } catch (dbError) {
    console.error('[ImageGen] Database error saving image:', {
      error: dbError instanceof Error ? dbError.message : dbError,
      threadId,
      filename,
      filepath,
      isWorkspaceContext: !!isWorkspaceContext,
    });
    throw dbError;
  }

  const docId = result.lastInsertRowid as number;

  return {
    id: imageId,
    filename,
    filepath,
    url: `${downloadUrlPrefix}/${docId}/download`,
    thumbnailUrl: thumbnailFilename
      ? `${downloadUrlPrefix}/${docId}/download?thumbnail=true`
      : undefined,
    width: metadata.width,
    height: metadata.height,
    provider,
    model,
    prompt: args.prompt,
    enhancedPrompt: metadata.enhancedPrompt,
    revisedPrompt: metadata.revisedPrompt,
    cached: false,
    generatedAt: new Date().toISOString(),
  };
}

// ===== Main Generation Function =====

/**
 * Generate an image using the configured provider
 *
 * @param args - Tool arguments from LLM
 * @returns Generation result with image hint for frontend
 */
export async function generateImage(
  args: ImageGenToolArgs
): Promise<ImageGenResponse> {
  const config = getImageGenConfig();

  // Check if enabled
  if (config.activeProvider === 'none') {
    return {
      success: false,
      error: {
        code: 'DISABLED',
        message: 'Image generation is disabled by administrator',
      },
    };
  }

  const startTime = Date.now();

  try {
    // Select provider
    const provider = selectProvider(args, config);
    const providerConfig = config.providers[provider];

    console.log(`[ImageGen] Using provider: ${provider}`);
    console.log(`[ImageGen] Original prompt: "${args.prompt.substring(0, 50)}..."`);

    // Enhance prompt
    const enhancedPrompt = enhancePrompt(args, config);

    // Generate image with selected provider
    let rawBuffer: Buffer;
    let revisedPrompt: string | undefined;

    if (provider === 'openai') {
      const result = await generateWithDalle(
        { ...args, prompt: enhancedPrompt },
        providerConfig as typeof config.providers.openai
      );
      rawBuffer = result.buffer;
      revisedPrompt = result.revisedPrompt;
    } else {
      const result = await generateWithGemini(
        { ...args, prompt: enhancedPrompt },
        providerConfig as typeof config.providers.gemini
      );
      rawBuffer = result.buffer;
      // Gemini doesn't return revised prompt
    }

    const generationTimeMs = Date.now() - startTime;
    console.log(`[ImageGen] Raw image received (${rawBuffer.length} bytes)`);

    // Process and optimize image
    const processingOptions: ProcessingOptions = {
      maxDimension: config.imageProcessing.maxDimension,
      format: config.imageProcessing.format,
      quality: config.imageProcessing.quality,
      generateThumbnail: config.imageProcessing.generateThumbnail,
      thumbnailSize: config.imageProcessing.thumbnailSize,
    };

    const processed = await processImage(rawBuffer, processingOptions);

    console.log(
      `[ImageGen] Processed: ${processed.metadata.originalWidth}x${processed.metadata.originalHeight} → ${processed.metadata.width}x${processed.metadata.height}, ${processed.metadata.sizeBytes} bytes`
    );

    // Save to disk and database
    const model =
      provider === 'openai'
        ? config.providers.openai.model
        : config.providers.gemini.model;

    const savedImage = await saveImage(
      processed.main,
      processed.thumbnail,
      args,
      provider,
      model,
      config,
      {
        width: processed.metadata.width,
        height: processed.metadata.height,
        format: processed.metadata.format,
        sizeBytes: processed.metadata.sizeBytes,
        enhancedPrompt,
        revisedPrompt,
        generationTimeMs,
      }
    );

    // Build response with imageHint for frontend rendering
    const imageHint: ImageHint = {
      id: savedImage.id,
      url: savedImage.url,
      thumbnailUrl: savedImage.thumbnailUrl,
      width: savedImage.width,
      height: savedImage.height,
      alt: `Generated ${args.style || 'image'}: ${args.prompt.substring(0, 100)}`,
    };

    return {
      success: true,
      message: 'Image generated successfully. Do NOT call image_gen again unless the user explicitly requests another image.',
      imageHint,
      metadata: {
        provider,
        model,
        prompt: args.prompt,
        enhancedPrompt,
        revisedPrompt,
        processingTimeMs: Date.now() - startTime,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    console.error('[ImageGen] Generation failed:', errorMessage);

    // Determine error code based on message
    let errorCode = 'GENERATION_ERROR';
    if (errorMessage.includes('API key')) {
      errorCode = 'INVALID_API_KEY';
    } else if (errorMessage.includes('rate limit')) {
      errorCode = 'RATE_LIMIT';
    } else if (errorMessage.includes('rejected') || errorMessage.includes('declined')) {
      errorCode = 'CONTENT_REJECTED';
    }

    return {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
      },
    };
  }
}
