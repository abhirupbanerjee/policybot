import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getRAGSettings,
  saveRAGSettings,
  getLLMSettings,
  saveLLMSettings,
  getAcronymMappings,
  saveAcronymMappings,
  getTavilySettings,
  saveTavilySettings,
  AVAILABLE_MODELS,
  DEFAULT_RAG_SETTINGS,
  DEFAULT_LLM_SETTINGS,
  DEFAULT_ACRONYM_MAPPINGS,
  DEFAULT_TAVILY_SETTINGS,
} from '@/lib/storage';
import { invalidateQueryCache, invalidateTavilyCache } from '@/lib/redis';
import type { ApiError } from '@/types';

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

    const [ragSettings, llmSettings, acronymMappings, tavilySettings] = await Promise.all([
      getRAGSettings(),
      getLLMSettings(),
      getAcronymMappings(),
      getTavilySettings(),
    ]);

    return NextResponse.json({
      rag: ragSettings,
      llm: llmSettings,
      acronyms: acronymMappings,
      tavily: tavilySettings,
      availableModels: AVAILABLE_MODELS,
      defaults: {
        rag: DEFAULT_RAG_SETTINGS,
        llm: DEFAULT_LLM_SETTINGS,
        acronyms: DEFAULT_ACRONYM_MAPPINGS,
        tavily: DEFAULT_TAVILY_SETTINGS,
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

        result = await saveRAGSettings({
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

        result = await saveLLMSettings({
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

        // Validate each mapping
        for (const [key, value] of Object.entries(mappings)) {
          if (typeof key !== 'string' || typeof value !== 'string') {
            return NextResponse.json<ApiError>(
              { error: 'All mappings must be string to string', code: 'VALIDATION_ERROR' },
              { status: 400 }
            );
          }
        }

        result = await saveAcronymMappings(mappings as Record<string, string>, user.email);
        break;
      }

      case 'tavily': {
        const {
          apiKey,
          enabled,
          defaultTopic,
          defaultSearchDepth,
          maxResults,
          includeDomains,
          excludeDomains,
          cacheTTLSeconds,
        } = settings;

        // Validate API key
        if (typeof apiKey !== 'string') {
          return NextResponse.json<ApiError>(
            { error: 'API key must be a string', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }

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

        result = await saveTavilySettings(settings, user.email);

        // Invalidate Tavily cache when settings change
        await invalidateTavilyCache();

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
