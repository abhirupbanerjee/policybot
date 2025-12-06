import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import type { ApiError } from '@/types';

interface ProviderStatus {
  provider: string;
  available: boolean;
  configured: boolean;
  error?: string;
}

interface ServiceStatus {
  name: string;
  model: string;
  provider: string;
  available: boolean;
  configured: boolean;
  error?: string;
}

// Check if environment variables are configured for each provider
function checkProviderConfig(): Record<string, boolean> {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    mistral: Boolean(process.env.MISTRAL_API_KEY),
    ollama: Boolean(process.env.OLLAMA_API_BASE),
    azure: Boolean(process.env.AZURE_API_KEY && process.env.AZURE_API_BASE),
  };
}

// Service definitions for embedding, OCR/extraction, and audio
const SERVICES = {
  embedding: {
    name: 'Embeddings',
    model: process.env.EMBEDDING_MODEL || 'text-embedding-3-large',
    getProvider: () => {
      const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';
      if (model.includes('ollama')) return 'ollama';
      if (model.includes('mistral')) return 'mistral';
      return 'openai';
    },
  },
  ocr: {
    name: 'Document OCR/Extraction',
    model: 'Azure Document Intelligence',
    getProvider: () => 'azure-di',
  },
  audio: {
    name: 'Audio Transcription',
    model: 'whisper-1',
    getProvider: () => 'openai', // Whisper via OpenAI/LiteLLM
  },
};

// Check Azure Document Intelligence availability
async function testAzureDI(): Promise<{ available: boolean; error?: string }> {
  const endpoint = process.env.AZURE_DI_ENDPOINT;
  const key = process.env.AZURE_DI_KEY;

  if (!endpoint || !key) {
    return { available: false, error: 'Azure DI endpoint or key not configured' };
  }

  try {
    // Test the Azure DI info endpoint
    const response = await fetch(`${endpoint}documentintelligence/info?api-version=2024-11-30`, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return { available: true };
    }
    return { available: false, error: `Azure DI error: ${response.status}` };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        return { available: false, error: 'Connection timeout' };
      }
      return { available: false, error: error.message };
    }
    return { available: false, error: 'Unknown error' };
  }
}

// Get service availability based on provider status
async function getServiceStatus(
  providerStatus: Record<string, ProviderStatus>
): Promise<Record<string, ServiceStatus>> {
  const services: Record<string, ServiceStatus> = {};

  // Embedding service
  const embeddingProvider = SERVICES.embedding.getProvider();
  const embeddingProviderStatus = providerStatus[embeddingProvider];
  services.embedding = {
    name: SERVICES.embedding.name,
    model: SERVICES.embedding.model,
    provider: embeddingProvider,
    available: embeddingProviderStatus?.available ?? false,
    configured: embeddingProviderStatus?.configured ?? false,
    error: embeddingProviderStatus?.error,
  };

  // OCR/Extraction service (Azure Document Intelligence)
  const azureDIConfigured = Boolean(process.env.AZURE_DI_ENDPOINT && process.env.AZURE_DI_KEY);
  if (azureDIConfigured) {
    const azureDIResult = await testAzureDI();
    services.ocr = {
      name: SERVICES.ocr.name,
      model: SERVICES.ocr.model,
      provider: 'azure-di',
      available: azureDIResult.available,
      configured: true,
      error: azureDIResult.error,
    };
  } else {
    services.ocr = {
      name: SERVICES.ocr.name,
      model: SERVICES.ocr.model,
      provider: 'azure-di',
      available: false,
      configured: false,
      error: 'Azure DI not configured',
    };
  }

  // Audio transcription service
  const audioProvider = SERVICES.audio.getProvider();
  const audioProviderStatus = providerStatus[audioProvider];
  services.audio = {
    name: SERVICES.audio.name,
    model: SERVICES.audio.model,
    provider: audioProvider,
    available: audioProviderStatus?.available ?? false,
    configured: audioProviderStatus?.configured ?? false,
    error: audioProviderStatus?.error,
  };

  return services;
}

// Test if a provider is reachable
async function testProvider(provider: string): Promise<{ available: boolean; error?: string }> {
  const timeout = 5000; // 5 second timeout

  try {
    switch (provider) {
      case 'openai': {
        // Test via LiteLLM proxy or direct OpenAI
        const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
          return { available: false, error: 'API key not configured' };
        }

        // Use LiteLLM health endpoint if using proxy
        if (baseUrl.includes('localhost') || baseUrl.includes('litellm')) {
          const healthUrl = baseUrl.replace('/v1', '/health');
          const response = await fetch(healthUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.LITELLM_MASTER_KEY || apiKey}`,
            },
            signal: AbortSignal.timeout(timeout),
          });

          if (response.ok) {
            return { available: true };
          }
          return { available: false, error: `LiteLLM health check failed: ${response.status}` };
        }

        // Direct OpenAI - test models endpoint
        const response = await fetch(`${baseUrl}/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          signal: AbortSignal.timeout(timeout),
        });

        if (response.ok) {
          return { available: true };
        }
        return { available: false, error: `OpenAI API error: ${response.status}` };
      }

      case 'mistral': {
        const apiKey = process.env.MISTRAL_API_KEY;
        if (!apiKey) {
          return { available: false, error: 'API key not configured' };
        }

        // If using LiteLLM proxy, check if OpenAI (proxy) is available instead
        // The actual Mistral connectivity is handled by LiteLLM
        if (process.env.OPENAI_BASE_URL) {
          return { available: true }; // Assume available if key is configured and proxy is used
        }

        // Direct Mistral API test
        const response = await fetch('https://api.mistral.ai/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          signal: AbortSignal.timeout(timeout),
        });

        if (response.ok) {
          return { available: true };
        }
        return { available: false, error: `Mistral API error: ${response.status}` };
      }

      case 'ollama': {
        const baseUrl = process.env.OLLAMA_API_BASE;
        if (!baseUrl) {
          return { available: false, error: 'Ollama base URL not configured' };
        }

        // Test Ollama API endpoint
        const response = await fetch(`${baseUrl}/api/tags`, {
          method: 'GET',
          signal: AbortSignal.timeout(timeout),
        });

        if (response.ok) {
          return { available: true };
        }
        return { available: false, error: `Ollama not reachable: ${response.status}` };
      }

      case 'azure': {
        const apiKey = process.env.AZURE_API_KEY;
        const baseUrl = process.env.AZURE_API_BASE;

        if (!apiKey || !baseUrl) {
          return { available: false, error: 'Azure API key or base URL not configured' };
        }

        // Azure OpenAI doesn't have a simple health check
        // We'll consider it available if configured
        return { available: true };
      }

      default:
        return { available: false, error: 'Unknown provider' };
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        return { available: false, error: 'Connection timeout' };
      }
      return { available: false, error: error.message };
    }
    return { available: false, error: 'Unknown error' };
  }
}

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

    const configuredProviders = checkProviderConfig();
    const providers = ['openai', 'mistral', 'ollama', 'azure'];

    // Test all providers in parallel
    const results = await Promise.all(
      providers.map(async (provider): Promise<ProviderStatus> => {
        const configured = configuredProviders[provider];

        if (!configured) {
          return {
            provider,
            available: false,
            configured: false,
            error: 'Not configured',
          };
        }

        const { available, error } = await testProvider(provider);
        return {
          provider,
          available,
          configured: true,
          error,
        };
      })
    );

    // Convert to object for easier access
    const providerStatus: Record<string, ProviderStatus> = {};
    for (const result of results) {
      providerStatus[result.provider] = result;
    }

    // Get service availability (embedding, OCR, audio)
    const services = await getServiceStatus(providerStatus);

    return NextResponse.json({
      providers: providerStatus,
      services,
      usingProxy: Boolean(process.env.OPENAI_BASE_URL),
      proxyUrl: process.env.OPENAI_BASE_URL || null,
    });
  } catch (error) {
    console.error('Provider check error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to check providers',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
