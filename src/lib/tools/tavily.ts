import { getWebSearchConfig } from '../db/tool-config';
import { hashQuery, getCachedQuery, cacheQuery } from '../redis';
import type { ToolDefinition, ValidationResult } from '../tools';

/**
 * Web Search configuration schema for admin UI
 */
const webSearchConfigSchema = {
  type: 'object',
  properties: {
    apiKey: {
      type: 'string',
      title: 'API Key',
      description: 'Tavily API key (get from https://tavily.com)',
      format: 'password',
    },
    defaultTopic: {
      type: 'string',
      title: 'Default Topic',
      description: 'Search topic category',
      enum: ['general', 'news', 'finance'],
      default: 'general',
    },
    defaultSearchDepth: {
      type: 'string',
      title: 'Search Depth',
      description: 'Basic = quick (3-5 results), Advanced = comprehensive (10+ results)',
      enum: ['basic', 'advanced'],
      default: 'basic',
    },
    maxResults: {
      type: 'number',
      title: 'Max Results',
      description: 'Maximum results per query (1-10)',
      minimum: 1,
      maximum: 10,
      default: 5,
    },
    includeDomains: {
      type: 'array',
      title: 'Include Domains',
      description: 'Only search these domains (comma-separated)',
      items: { type: 'string' },
      default: [],
    },
    excludeDomains: {
      type: 'array',
      title: 'Exclude Domains',
      description: 'Never search these domains (comma-separated)',
      items: { type: 'string' },
      default: [],
    },
    cacheTTLSeconds: {
      type: 'number',
      title: 'Cache Duration (seconds)',
      description: 'How long to cache search results',
      minimum: 60,
      maximum: 2592000,
      default: 3600,
    },
  },
  required: ['defaultTopic', 'defaultSearchDepth', 'maxResults', 'cacheTTLSeconds'],
};

/**
 * Validate web search configuration
 */
function validateWebSearchConfig(config: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  // Validate defaultTopic
  if (config.defaultTopic && !['general', 'news', 'finance'].includes(config.defaultTopic as string)) {
    errors.push('defaultTopic must be one of: general, news, finance');
  }

  // Validate defaultSearchDepth
  if (config.defaultSearchDepth && !['basic', 'advanced'].includes(config.defaultSearchDepth as string)) {
    errors.push('defaultSearchDepth must be one of: basic, advanced');
  }

  // Validate maxResults
  if (config.maxResults !== undefined) {
    const maxResults = config.maxResults as number;
    if (typeof maxResults !== 'number' || maxResults < 1 || maxResults > 10) {
      errors.push('maxResults must be a number between 1 and 10');
    }
  }

  // Validate cacheTTLSeconds
  if (config.cacheTTLSeconds !== undefined) {
    const cacheTTL = config.cacheTTLSeconds as number;
    if (typeof cacheTTL !== 'number' || cacheTTL < 60 || cacheTTL > 2592000) {
      errors.push('cacheTTLSeconds must be a number between 60 and 2592000');
    }
  }

  // Validate arrays
  if (config.includeDomains && !Array.isArray(config.includeDomains)) {
    errors.push('includeDomains must be an array');
  }
  if (config.excludeDomains && !Array.isArray(config.excludeDomains)) {
    errors.push('excludeDomains must be an array');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Tavily web search tool implementation
 * Provides web search capabilities with Redis caching
 */
export const tavilyWebSearch: ToolDefinition = {
  name: 'web_search',
  displayName: 'Web Search',
  description: 'Search the web for current information, news, or data not available in the organizational knowledge base.',
  category: 'autonomous',

  definition: {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information, news, or data not available in the organizational knowledge base. Use when internal documents do not contain the answer or when user asks about recent events or current data.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find relevant web information',
          },
          max_results: {
            type: 'number',
            description: 'Number of results to return (1-10, default: 5)',
            default: 5,
          },
        },
        required: ['query'],
      },
    },
  },

  validateConfig: validateWebSearchConfig,

  defaultConfig: {
    apiKey: '',
    defaultTopic: 'general',
    defaultSearchDepth: 'basic',
    maxResults: 5,
    includeDomains: [],
    excludeDomains: [],
    cacheTTLSeconds: 3600,
  },

  configSchema: webSearchConfigSchema,

  execute: async (args: { query: string; max_results?: number }) => {
    // Get config from unified tool_configs table (with fallback to settings table)
    const { enabled, config: settings } = getWebSearchConfig();

    // Check settings first, fall back to environment variable
    const apiKey = settings.apiKey || process.env.TAVILY_API_KEY;

    // Check if web search is enabled
    if (!enabled) {
      return JSON.stringify({
        error: 'Web search is currently disabled',
        errorCode: 'TOOL_DISABLED',
        results: [],
      });
    }

    if (!apiKey) {
      return JSON.stringify({
        error: 'Web search not configured - please set API key in admin settings',
        errorCode: 'NOT_CONFIGURED',
        results: [],
      });
    }

    // Check Redis cache first
    const cacheKey = hashQuery(args.query);
    const cached = await getCachedQuery(`tavily:${cacheKey}`);

    if (cached) {
      console.log('Web search cache hit:', args.query);
      return cached;
    }

    // Cache miss - call Tavily API
    console.log('Web search cache miss - calling Tavily:', args.query);

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: args.query,
          max_results: Math.min(args.max_results || settings.maxResults, 10),
          search_depth: settings.defaultSearchDepth,
          topic: settings.defaultTopic,
          include_answer: false,
          include_raw_content: false,
          include_domains: settings.includeDomains.length > 0
            ? settings.includeDomains
            : undefined,
          exclude_domains: settings.excludeDomains.length > 0
            ? settings.excludeDomains
            : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }

      const data = await response.json();
      const resultString = JSON.stringify(data, null, 2);

      // Cache the result
      await cacheQuery(`tavily:${cacheKey}`, resultString, settings.cacheTTLSeconds);

      return resultString;
    } catch (error) {
      console.error('Tavily API error:', error);
      return JSON.stringify({
        error: 'Web search temporarily unavailable',
        errorCode: 'API_ERROR',
        results: [],
      });
    }
  },
};
