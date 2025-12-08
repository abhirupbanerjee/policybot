import { getTavilySettings } from '../db/config';
import { hashQuery, getCachedQuery, cacheQuery } from '../redis';
import type { ToolDefinition } from '../tools';

/**
 * Tavily web search tool implementation
 * Provides web search capabilities with Redis caching
 */
export const tavilyWebSearch: ToolDefinition = {
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

  execute: async (args: { query: string; max_results?: number }) => {
    const settings = getTavilySettings();
    // Check settings first, fall back to environment variable
    const apiKey = settings.apiKey || process.env.TAVILY_API_KEY;

    // Check if web search is enabled
    if (!settings.enabled) {
      return JSON.stringify({
        error: 'Web search is currently disabled',
        results: [],
      });
    }

    if (!apiKey) {
      return JSON.stringify({
        error: 'Web search not configured - please set API key in admin settings',
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
        results: [],
      });
    }
  },
};
