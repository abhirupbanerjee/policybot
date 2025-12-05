import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getRagSettings,
  setRagSettings,
  getLlmSettings,
  setLlmSettings,
  getAcronymMappings,
  setAcronymMappings,
  getTavilySettings,
  setTavilySettings,
  getUploadLimits,
  setUploadLimits,
  getRetentionSettings,
  setRetentionSettings,
  getBrandingSettings,
  setBrandingSettings,
  getSettingMetadata,
  setSystemPrompt,
  MODEL_PRESETS,
  BRANDING_ICONS,
  DEFAULT_PRESET_ID,
  getDefaultSystemPrompt,
} from '@/lib/db/config';
import { invalidateQueryCache, invalidateTavilyCache } from '@/lib/redis';
import type { ApiError } from '@/types';

// Available models for selection (includes preset models + legacy models)
const AVAILABLE_MODELS = [
  // Preset models (recommended)
  { id: 'gpt-5.1', name: 'GPT-5.1', description: 'Most capable - high accuracy for complex policy analysis' },
  { id: 'gpt-5.1-mini', name: 'GPT-5.1 Mini', description: 'Balanced - fast and affordable for most queries' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Cost-effective - simpler queries, faster responses' },
  // Legacy models
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable for most tasks' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable model for complex tasks' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High performance with larger context' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and cost-effective' },
];

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ApiError>(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    if (!user.isAdmin) {
      return NextResponse.json<ApiError>(
        { error: 'Admin access required', code: 'ADMIN_REQUIRED' },
        { status: 403 }
      );
    }

    // Get all settings from SQLite
    const ragSettings = getRagSettings();
    const llmSettings = getLlmSettings();
    const acronymMappings = getAcronymMappings();
    const tavilySettings = getTavilySettings();
    const uploadLimits = getUploadLimits();
    const retentionSettings = getRetentionSettings();
    const brandingSettings = getBrandingSettings();

    // Get metadata for last updated info
    const ragMeta = getSettingMetadata('rag-settings');
    const llmMeta = getSettingMetadata('llm-settings');
    const acronymsMeta = getSettingMetadata('acronym-mappings');
    const tavilyMeta = getSettingMetadata('tavily-settings');
    const brandingMeta = getSettingMetadata('branding-settings');

    return NextResponse.json({
      rag: {
        ...ragSettings,
        updatedAt: ragMeta?.updatedAt || new Date().toISOString(),
        updatedBy: ragMeta?.updatedBy || 'system',
      },
      llm: {
        ...llmSettings,
        updatedAt: llmMeta?.updatedAt || new Date().toISOString(),
        updatedBy: llmMeta?.updatedBy || 'system',
      },
      acronyms: {
        mappings: acronymMappings,
        updatedAt: acronymsMeta?.updatedAt || new Date().toISOString(),
        updatedBy: acronymsMeta?.updatedBy || 'system',
      },
      tavily: {
        ...tavilySettings,
        apiKey: process.env.TAVILY_API_KEY || '',
        updatedAt: tavilyMeta?.updatedAt || new Date().toISOString(),
        updatedBy: tavilyMeta?.updatedBy || 'system',
      },
      branding: {
        ...brandingSettings,
        updatedAt: brandingMeta?.updatedAt || new Date().toISOString(),
        updatedBy: brandingMeta?.updatedBy || 'system',
      },
      uploadLimits,
      retentionSettings,
      availableModels: AVAILABLE_MODELS,
      modelPresets: MODEL_PRESETS,
      brandingIcons: BRANDING_ICONS,
      defaults: {
        // Return true hardcoded defaults from the default preset
        rag: MODEL_PRESETS.find(p => p.id === DEFAULT_PRESET_ID)?.ragSettings,
        llm: MODEL_PRESETS.find(p => p.id === DEFAULT_PRESET_ID)?.llmSettings,
        systemPrompt: getDefaultSystemPrompt(),
        presetId: DEFAULT_PRESET_ID,
        acronyms: { mappings: {} },
        tavily: getTavilySettings(),
        branding: getBrandingSettings(),
      },
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to get settings',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ApiError>(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    if (!user.isAdmin) {
      return NextResponse.json<ApiError>(
        { error: 'Admin access required', code: 'ADMIN_REQUIRED' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { type, settings } = body;

    if (!type || !settings) {
      return NextResponse.json<ApiError>(
        { error: 'Type and settings are required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case 'rag': {
        // Validate RAG settings
        const { topKChunks, maxContextChunks, similarityThreshold, chunkSize, chunkOverlap, queryExpansionEnabled, cacheEnabled, cacheTTLSeconds } = settings;

        if (typeof topKChunks !== 'number' || topKChunks < 1 || topKChunks > 50) {
          return NextResponse.json<ApiError>(
            { error: 'Top K chunks must be between 1 and 50', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        if (typeof maxContextChunks !== 'number' || maxContextChunks < 1 || maxContextChunks > 30) {
          return NextResponse.json<ApiError>(
            { error: 'Max context chunks must be between 1 and 30', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        if (typeof similarityThreshold !== 'number' || similarityThreshold < 0 || similarityThreshold > 1) {
          return NextResponse.json<ApiError>(
            { error: 'Similarity threshold must be between 0 and 1', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        if (typeof chunkSize !== 'number' || chunkSize < 100 || chunkSize > 2000) {
          return NextResponse.json<ApiError>(
            { error: 'Chunk size must be between 100 and 2000', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        if (typeof chunkOverlap !== 'number' || chunkOverlap < 0 || chunkOverlap > chunkSize / 2) {
          return NextResponse.json<ApiError>(
            { error: 'Chunk overlap must be between 0 and half of chunk size', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        if (typeof cacheTTLSeconds !== 'number' || cacheTTLSeconds < 0 || cacheTTLSeconds > 86400) {
          return NextResponse.json<ApiError>(
            { error: 'Cache TTL must be between 0 and 86400 seconds (24 hours)', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        result = setRagSettings({
          topKChunks,
          maxContextChunks,
          similarityThreshold,
          chunkSize,
          chunkOverlap,
          queryExpansionEnabled: Boolean(queryExpansionEnabled),
          cacheEnabled: Boolean(cacheEnabled),
          cacheTTLSeconds,
        }, user.email);
        break;
      }

      case 'llm': {
        // Validate LLM settings
        const { model, temperature, maxTokens } = settings;

        if (!model || !AVAILABLE_MODELS.some(m => m.id === model)) {
          return NextResponse.json<ApiError>(
            { error: 'Invalid model selected', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
          return NextResponse.json<ApiError>(
            { error: 'Temperature must be between 0 and 2', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        if (typeof maxTokens !== 'number' || maxTokens < 100 || maxTokens > 16000) {
          return NextResponse.json<ApiError>(
            { error: 'Max tokens must be between 100 and 16000', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        result = setLlmSettings({
          model,
          temperature,
          maxTokens,
        }, user.email);
        break;
      }

      case 'acronyms': {
        // Validate acronym mappings
        const { mappings } = settings;

        if (!mappings || typeof mappings !== 'object') {
          return NextResponse.json<ApiError>(
            { error: 'Mappings must be an object', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        // Convert string values to arrays for new format
        const normalizedMappings: Record<string, string[]> = {};
        for (const [key, value] of Object.entries(mappings)) {
          if (typeof key !== 'string') {
            return NextResponse.json<ApiError>(
              { error: 'All mapping keys must be strings', code: 'VALIDATION_ERROR' },
              { status: 400 }
            );
          }
          // Accept both string and string[] for backward compatibility
          if (typeof value === 'string') {
            normalizedMappings[key.toLowerCase()] = [value];
          } else if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
            normalizedMappings[key.toLowerCase()] = value;
          } else {
            return NextResponse.json<ApiError>(
              { error: 'Mapping values must be strings or arrays of strings', code: 'VALIDATION_ERROR' },
              { status: 400 }
            );
          }
        }

        setAcronymMappings(normalizedMappings, user.email);
        result = { mappings: normalizedMappings };
        break;
      }

      case 'tavily': {
        const {
          enabled,
          defaultTopic,
          defaultSearchDepth,
          maxResults,
          includeDomains,
          excludeDomains,
          cacheTTLSeconds,
        } = settings;

        // Validate enabled flag
        if (typeof enabled !== 'boolean') {
          return NextResponse.json<ApiError>(
            { error: 'Enabled must be a boolean', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        // Validate topic
        if (!['general', 'news', 'finance'].includes(defaultTopic)) {
          return NextResponse.json<ApiError>(
            { error: 'Topic must be general, news, or finance', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        // Validate search depth
        if (!['basic', 'advanced'].includes(defaultSearchDepth)) {
          return NextResponse.json<ApiError>(
            { error: 'Search depth must be basic or advanced', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        // Validate max results
        if (typeof maxResults !== 'number' || maxResults < 1 || maxResults > 20) {
          return NextResponse.json<ApiError>(
            { error: 'Max results must be between 1 and 20', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        // Validate cache TTL (1 minute to 1 month)
        if (typeof cacheTTLSeconds !== 'number' || cacheTTLSeconds < 60 || cacheTTLSeconds > 2592000) {
          return NextResponse.json<ApiError>(
            { error: 'Cache TTL must be between 60 seconds and 2592000 seconds (1 month)', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        // Validate domains
        if (!Array.isArray(includeDomains) || !includeDomains.every(d => typeof d === 'string')) {
          return NextResponse.json<ApiError>(
            { error: 'Include domains must be an array of strings', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        if (!Array.isArray(excludeDomains) || !excludeDomains.every(d => typeof d === 'string')) {
          return NextResponse.json<ApiError>(
            { error: 'Exclude domains must be an array of strings', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        result = setTavilySettings({
          enabled,
          defaultTopic,
          defaultSearchDepth,
          maxResults,
          includeDomains,
          excludeDomains,
          cacheTTLSeconds,
        }, user.email);

        // Invalidate Tavily cache when settings change
        await invalidateTavilyCache();

        break;
      }

      case 'uploadLimits': {
        const { maxFilesPerThread, maxFileSizeMB, allowedTypes } = settings;

        if (typeof maxFilesPerThread !== 'number' || maxFilesPerThread < 1 || maxFilesPerThread > 20) {
          return NextResponse.json<ApiError>(
            { error: 'Max files per thread must be between 1 and 20', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        if (typeof maxFileSizeMB !== 'number' || maxFileSizeMB < 1 || maxFileSizeMB > 100) {
          return NextResponse.json<ApiError>(
            { error: 'Max file size must be between 1 and 100 MB', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        if (!Array.isArray(allowedTypes) || !allowedTypes.every(t => typeof t === 'string')) {
          return NextResponse.json<ApiError>(
            { error: 'Allowed types must be an array of strings', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        result = setUploadLimits({
          maxFilesPerThread,
          maxFileSizeMB,
          allowedTypes,
        }, user.email);
        break;
      }

      case 'retention': {
        const { threadRetentionDays, storageAlertThreshold } = settings;

        if (typeof threadRetentionDays !== 'number' || threadRetentionDays < 1 || threadRetentionDays > 365) {
          return NextResponse.json<ApiError>(
            { error: 'Thread retention days must be between 1 and 365', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        if (typeof storageAlertThreshold !== 'number' || storageAlertThreshold < 50 || storageAlertThreshold > 100) {
          return NextResponse.json<ApiError>(
            { error: 'Storage alert threshold must be between 50 and 100 percent', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        result = setRetentionSettings({
          threadRetentionDays,
          storageAlertThreshold,
        }, user.email);
        break;
      }

      case 'preset': {
        // Apply a model preset (updates both LLM and RAG settings)
        const { presetId } = settings;

        const preset = MODEL_PRESETS.find(p => p.id === presetId);
        if (!preset) {
          return NextResponse.json<ApiError>(
            { error: 'Invalid preset selected', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        // Apply both LLM and RAG settings from the preset
        const updatedLlm = setLlmSettings(preset.llmSettings, user.email);
        const updatedRag = setRagSettings(preset.ragSettings, user.email);

        result = {
          preset: preset,
          llm: updatedLlm,
          rag: updatedRag,
        };
        break;
      }

      case 'branding': {
        const { botName, botIcon } = settings;

        // Validate bot name
        if (typeof botName !== 'string' || botName.trim().length === 0) {
          return NextResponse.json<ApiError>(
            { error: 'Bot name is required', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        if (botName.length > 50) {
          return NextResponse.json<ApiError>(
            { error: 'Bot name must be 50 characters or less', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        // Validate bot icon
        const validIcons = BRANDING_ICONS.map(i => i.key);
        if (!validIcons.includes(botIcon)) {
          return NextResponse.json<ApiError>(
            { error: 'Invalid icon selected', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

        result = setBrandingSettings({
          botName: botName.trim(),
          botIcon,
        }, user.email);

        // Return the updated branding with metadata
        const brandingMeta = getSettingMetadata('branding-settings');
        return NextResponse.json({
          success: true,
          branding: {
            ...result,
            updatedAt: brandingMeta?.updatedAt || new Date().toISOString(),
            updatedBy: brandingMeta?.updatedBy || user.email,
          },
        });
      }

      case 'restoreAllDefaults': {
        // Find the default preset (gpt-4.1-mini)
        const defaultPreset = MODEL_PRESETS.find(p => p.id === DEFAULT_PRESET_ID);
        if (!defaultPreset) {
          return NextResponse.json<ApiError>(
            { error: 'Default preset not found', code: 'SERVICE_ERROR' },
            { status: 500 }
          );
        }

        // Apply LLM settings from preset
        const updatedLlm = setLlmSettings(defaultPreset.llmSettings, user.email);

        // Apply RAG settings from preset
        const updatedRag = setRagSettings(defaultPreset.ragSettings, user.email);

        // Restore default system prompt
        const defaultPrompt = getDefaultSystemPrompt();
        setSystemPrompt(defaultPrompt, user.email);

        result = {
          llm: updatedLlm,
          rag: updatedRag,
          systemPrompt: defaultPrompt,
          preset: defaultPreset,
        };
        break;
      }

      default:
        return NextResponse.json<ApiError>(
          { error: 'Invalid settings type', code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
    }

    // Invalidate query cache when settings change
    await invalidateQueryCache();

    return NextResponse.json({
      success: true,
      settings: result,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to update settings',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
