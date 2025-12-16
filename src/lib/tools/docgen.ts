/**
 * Document Generation Tool Definition
 *
 * Processor tool for generating branded PDF and Word documents
 * from chat content. This is a post-response processor tool,
 * not an autonomous LLM-triggered tool.
 */

import type { ToolDefinition, ValidationResult } from '../tools';
import { getToolConfig, TOOL_DEFAULTS } from '../db/tool-config';
import { getEffectiveToolConfig, type BrandingConfig } from '../db/category-tool-config';
import {
  createDocumentGenerator,
  type DocumentFormat,
  type GeneratedDocument,
  type DocGenConfig,
} from '../docgen/document-generator';

// ============ Config Schema ============

const docGenConfigSchema = {
  type: 'object',
  properties: {
    defaultFormat: {
      type: 'string',
      title: 'Default Format',
      description: 'Default document format when not specified',
      enum: ['pdf', 'docx', 'md'],
      default: 'pdf',
    },
    enabledFormats: {
      type: 'array',
      title: 'Enabled Formats',
      description: 'Document formats available for export',
      items: {
        type: 'string',
        enum: ['pdf', 'docx', 'md'],
      },
      default: ['pdf', 'docx', 'md'],
    },
    branding: {
      type: 'object',
      title: 'Branding Settings',
      description: 'Document branding configuration',
      properties: {
        enabled: {
          type: 'boolean',
          title: 'Enable Branding',
          description: 'Add organization branding to documents',
          default: false,
        },
        logoUrl: {
          type: 'string',
          title: 'Logo URL',
          description: 'URL or data URL of organization logo',
          default: '',
        },
        organizationName: {
          type: 'string',
          title: 'Organization Name',
          description: 'Name displayed in document header',
          default: '',
        },
        primaryColor: {
          type: 'string',
          title: 'Primary Color',
          description: 'Primary color for headings and accents (hex)',
          pattern: '^#[0-9A-Fa-f]{6}$',
          default: '#003366',
        },
        fontFamily: {
          type: 'string',
          title: 'Font Family',
          description: 'Primary font for document text',
          default: 'Calibri',
        },
      },
    },
    header: {
      type: 'object',
      title: 'Header Settings',
      properties: {
        enabled: {
          type: 'boolean',
          title: 'Enable Header',
          default: true,
        },
        content: {
          type: 'string',
          title: 'Header Content',
          description: 'Custom header text (supports {{date}}, {{organization}})',
          default: '',
        },
      },
    },
    footer: {
      type: 'object',
      title: 'Footer Settings',
      properties: {
        enabled: {
          type: 'boolean',
          title: 'Enable Footer',
          default: true,
        },
        content: {
          type: 'string',
          title: 'Footer Content',
          description: 'Custom footer text (supports {{date}}, {{page}}, {{total}})',
          default: '',
        },
        includePageNumber: {
          type: 'boolean',
          title: 'Include Page Number',
          default: true,
        },
      },
    },
    expirationDays: {
      type: 'number',
      title: 'Document Expiration (days)',
      description: 'Days until generated documents expire (0 = never)',
      minimum: 0,
      maximum: 365,
      default: 30,
    },
    maxDocumentSizeMB: {
      type: 'number',
      title: 'Max Document Size (MB)',
      description: 'Maximum generated document size',
      minimum: 1,
      maximum: 100,
      default: 50,
    },
  },
};

// ============ Validation ============

function validateDocGenConfig(config: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  // Validate defaultFormat
  if (config.defaultFormat && !['pdf', 'docx', 'md'].includes(config.defaultFormat as string)) {
    errors.push('defaultFormat must be one of: pdf, docx, md');
  }

  // Validate enabledFormats
  if (config.enabledFormats) {
    if (!Array.isArray(config.enabledFormats)) {
      errors.push('enabledFormats must be an array');
    } else {
      const validFormats = ['pdf', 'docx', 'md'];
      for (const format of config.enabledFormats) {
        if (!validFormats.includes(format as string)) {
          errors.push(`Invalid format in enabledFormats: ${format}`);
        }
      }
    }
  }

  // Validate branding
  if (config.branding) {
    const branding = config.branding as Record<string, unknown>;

    if (branding.primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(branding.primaryColor as string)) {
      errors.push('branding.primaryColor must be a valid hex color (e.g., #003366)');
    }

    if (branding.logoUrl && typeof branding.logoUrl !== 'string') {
      errors.push('branding.logoUrl must be a string');
    }

    if (branding.organizationName && typeof branding.organizationName !== 'string') {
      errors.push('branding.organizationName must be a string');
    }
  }

  // Validate expirationDays
  if (config.expirationDays !== undefined) {
    const days = config.expirationDays as number;
    if (typeof days !== 'number' || days < 0 || days > 365) {
      errors.push('expirationDays must be a number between 0 and 365');
    }
  }

  // Validate maxDocumentSizeMB
  if (config.maxDocumentSizeMB !== undefined) {
    const size = config.maxDocumentSizeMB as number;
    if (typeof size !== 'number' || size < 1 || size > 100) {
      errors.push('maxDocumentSizeMB must be a number between 1 and 100');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============ Tool Definition ============

export const documentGenerationTool: ToolDefinition = {
  name: 'doc_gen',
  displayName: 'Document Generation',
  description: 'Export chat responses as branded PDF or Word documents',
  category: 'processor',

  // No OpenAI function definition - this is a processor tool, not autonomous
  definition: undefined,

  validateConfig: validateDocGenConfig,

  defaultConfig: TOOL_DEFAULTS.doc_gen.config,

  configSchema: docGenConfigSchema,

  /**
   * Execute document generation
   *
   * Args expected:
   * - title: string - Document title
   * - content: string - Markdown content to convert
   * - format: 'pdf' | 'docx' - Output format
   * - threadId?: string - Associated thread ID
   * - messageId?: string - Associated message ID
   * - categoryId?: number - Category for branding resolution
   */
  execute: async (args: {
    title: string;
    content: string;
    format?: DocumentFormat;
    threadId?: string;
    messageId?: string;
    categoryId?: number;
  }): Promise<string> => {
    try {
      // Get tool configuration
      const toolConfig = getToolConfig('doc_gen');
      const config = toolConfig?.config || TOOL_DEFAULTS.doc_gen.config;

      // Build DocGenConfig
      const docGenConfig: DocGenConfig = {
        enabled: toolConfig?.isEnabled ?? TOOL_DEFAULTS.doc_gen.enabled,
        defaultFormat: (config.defaultFormat as DocumentFormat) || 'pdf',
        enabledFormats: (config.enabledFormats as DocumentFormat[]) || ['pdf', 'docx'],
        branding: config.branding as BrandingConfig,
        expirationDays: (config.expirationDays as number) || 30,
        maxDocumentSizeMB: (config.maxDocumentSizeMB as number) || 50,
      };

      // Check if tool is enabled
      if (!docGenConfig.enabled) {
        return JSON.stringify({
          error: 'Document generation is currently disabled',
          errorCode: 'TOOL_DISABLED',
        });
      }

      // Get category branding if applicable
      let categoryBranding: BrandingConfig | null = null;
      if (args.categoryId) {
        const effective = getEffectiveToolConfig('doc_gen', args.categoryId);
        categoryBranding = effective.branding;
      }

      // Create generator
      const generator = createDocumentGenerator(docGenConfig, categoryBranding);

      // Determine format
      const format = args.format || docGenConfig.defaultFormat;

      // Generate document
      const result = await generator.generate({
        title: args.title,
        content: args.content,
        format,
        threadId: args.threadId,
        messageId: args.messageId,
        categoryId: args.categoryId,
      });

      return JSON.stringify({
        success: true,
        document: {
          id: result.id,
          filename: result.filename,
          fileType: result.fileType,
          fileSize: result.fileSize,
          fileSizeFormatted: formatFileSize(result.fileSize),
          downloadUrl: result.downloadUrl,
          expiresAt: result.expiresAt,
        },
      });
    } catch (error) {
      console.error('[DocGen] Generation error:', error);
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error during document generation',
        errorCode: 'GENERATION_ERROR',
      });
    }
  },
};

// ============ Helper Functions ============

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ============ Convenience Functions ============

/**
 * Get the document generation configuration
 */
export function getDocGenConfig(): DocGenConfig {
  const toolConfig = getToolConfig('doc_gen');
  const config = toolConfig?.config || TOOL_DEFAULTS.doc_gen.config;

  return {
    enabled: toolConfig?.isEnabled ?? TOOL_DEFAULTS.doc_gen.enabled,
    defaultFormat: (config.defaultFormat as DocumentFormat) || 'pdf',
    enabledFormats: (config.enabledFormats as DocumentFormat[]) || ['pdf', 'docx'],
    branding: config.branding as BrandingConfig,
    expirationDays: (config.expirationDays as number) || 30,
    maxDocumentSizeMB: (config.maxDocumentSizeMB as number) || 50,
  };
}

/**
 * Check if document generation is enabled
 */
export function isDocGenEnabled(): boolean {
  const toolConfig = getToolConfig('doc_gen');
  return toolConfig?.isEnabled ?? TOOL_DEFAULTS.doc_gen.enabled;
}

/**
 * Get enabled formats
 */
export function getEnabledFormats(): DocumentFormat[] {
  const config = getDocGenConfig();
  return config.enabledFormats;
}

// ============ Export Types ============

export type { DocumentFormat, GeneratedDocument, DocGenConfig };
