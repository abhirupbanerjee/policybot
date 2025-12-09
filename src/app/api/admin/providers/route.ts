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
  category: 'llm' | 'embedding' | 'transcribe' | 'ocr' | 'reranker';
  name: string;
  model: string;
  provider: string;
  available: boolean;
  configured: boolean;
  error?: string;
  latency?: number;
}

// Check if environment variables are configured for each provider
function checkProviderConfig(): Record<string, boolean> {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    mistral: Boolean(process.env.MISTRAL_API_KEY),
    ollama: Boolean(process.env.OLLAMA_API_BASE),
    azure: Boolean(process.env.AZURE_API_KEY && process.env.AZURE_API_BASE),
    gemini: Boolean(process.env.GEMINI_API_KEY),
  };
}

// All configured models organized by category
const MODEL_CONFIG = {
  llm: [
    // OpenAI
    { model: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai' },
    { model: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'openai' },
    { model: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'openai' },
    { model: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
    // Mistral
    { model: 'mistral-large-3', name: 'Mistral Large 3', provider: 'mistral' },
    { model: 'mistral-medium-3.1', name: 'Mistral Medium 3.1', provider: 'mistral' },
    { model: 'mistral-small-3.2', name: 'Mistral Small 3.2', provider: 'mistral' },
    { model: 'ministral-8b', name: 'Ministral 8B', provider: 'mistral' },
    { model: 'ministral-3b', name: 'Ministral 3B', provider: 'mistral' },
    // Gemini
    { model: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini' },
    { model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini' },
    { model: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', provider: 'gemini' },
    // Ollama
    { model: 'ollama-llama3.2', name: 'Llama 3.2', provider: 'ollama' },
    { model: 'ollama-llama3.1', name: 'Llama 3.1', provider: 'ollama' },
    { model: 'ollama-mistral', name: 'Mistral (Local)', provider: 'ollama' },
    { model: 'ollama-qwen2.5', name: 'Qwen 2.5', provider: 'ollama' },
    { model: 'ollama-phi4', name: 'Phi-4', provider: 'ollama' },
  ],
  embedding: [
    // OpenAI
    { model: 'text-embedding-3-large', name: 'Embedding 3 Large', provider: 'openai' },
    { model: 'text-embedding-3-small', name: 'Embedding 3 Small', provider: 'openai' },
    // Mistral
    { model: 'mistral-embed', name: 'Mistral Embed', provider: 'mistral' },
    { model: 'codestral-embed', name: 'Codestral Embed', provider: 'mistral' },
    // Ollama
    { model: 'ollama-nomic-embed', name: 'Nomic Embed', provider: 'ollama' },
    { model: 'ollama-mxbai-embed', name: 'MxBai Embed', provider: 'ollama' },
  ],
  transcribe: [
    // OpenAI
    { model: 'whisper-1', name: 'Whisper', provider: 'openai' },
    // Mistral
    { model: 'voxtral-small', name: 'Voxtral Small', provider: 'mistral' },
    { model: 'voxtral-mini', name: 'Voxtral Mini', provider: 'mistral' },
  ],
  ocr: [
    // Azure
    { model: 'prebuilt-read', name: 'Azure Document Intelligence', provider: 'azure-di' },
    // Mistral
    { model: 'pixtral-12b-2409', name: 'Pixtral OCR', provider: 'mistral' },
  ],
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

// Get all services with status organized by category
async function getAllServicesStatus(
  providerStatus: Record<string, ProviderStatus>
): Promise<ServiceStatus[]> {
  const services: ServiceStatus[] = [];

  // Azure DI special handling
  const azureDIConfigured = Boolean(process.env.AZURE_DI_ENDPOINT && process.env.AZURE_DI_KEY);
  let azureDIResult: { available: boolean; error?: string } | null = null;
  if (azureDIConfigured) {
    azureDIResult = await testAzureDI();
  }

  // Process all categories
  for (const [category, models] of Object.entries(MODEL_CONFIG)) {
    for (const modelDef of models) {
      let available = false;
      let configured = false;
      let error: string | undefined;

      if (modelDef.provider === 'azure-di') {
        // Special handling for Azure Document Intelligence
        configured = azureDIConfigured;
        available = azureDIResult?.available ?? false;
        error = azureDIConfigured ? azureDIResult?.error : 'Azure DI not configured';
      } else {
        // Use provider status for standard providers
        const status = providerStatus[modelDef.provider];
        configured = status?.configured ?? false;
        available = status?.available ?? false;
        error = status?.error;
      }

      services.push({
        category: category as ServiceStatus['category'],
        name: modelDef.name,
        model: modelDef.model,
        provider: modelDef.provider,
        available,
        configured,
        error: configured && !available ? error : (configured ? undefined : 'Not configured'),
      });
    }
  }

  return services;
}

// Test a model via LiteLLM proxy with a minimal completion request
async function testModelViaProxy(
  model: string,
  timeout: number
): Promise<{ available: boolean; error?: string }> {
  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.LITELLM_MASTER_KEY || process.env.OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    return { available: false, error: 'Proxy not configured' };
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (response.ok) {
      return { available: true };
    }

    // Parse error for more details
    const errorData = await response.json().catch(() => null);
    const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
    return { available: false, error: errorMsg };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        return { available: false, error: 'Request timeout' };
      }
      return { available: false, error: error.message };
    }
    return { available: false, error: 'Unknown error' };
  }
}

// Test if a provider is reachable
async function testProvider(provider: string): Promise<{ available: boolean; error?: string }> {
  const timeout = 8000; // 8 second timeout for actual API calls

  try {
    switch (provider) {
      case 'openai': {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return { available: false, error: 'API key not configured' };
        }

        // If using LiteLLM proxy, test with an actual OpenAI model request
        if (process.env.OPENAI_BASE_URL) {
          return testModelViaProxy('gpt-4.1-mini', timeout);
        }

        // Direct OpenAI - test models endpoint
        const baseUrl = 'https://api.openai.com/v1';
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

        // If using LiteLLM proxy, test with an actual Mistral model request
        if (process.env.OPENAI_BASE_URL) {
          return testModelViaProxy('mistral-small-3.2', timeout);
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

      case 'gemini': {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return { available: false, error: 'API key not configured' };
        }
        // Test via LiteLLM proxy if configured
        if (process.env.OPENAI_BASE_URL) {
          return testModelViaProxy('gemini-2.5-flash', timeout);
        }
        // Direct API test - Google AI Studio
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            {
              method: 'GET',
              signal: AbortSignal.timeout(timeout),
            }
          );
          if (response.ok) {
            return { available: true };
          }
          return { available: false, error: `Gemini API error: ${response.status}` };
        } catch (error) {
          if (error instanceof Error) {
            return { available: false, error: error.message };
          }
          return { available: false, error: 'Unknown error' };
        }
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
    const providers = ['openai', 'mistral', 'ollama', 'azure', 'gemini'];

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

    // Get all services with status (LLM, Embedding, Transcribe, OCR)
    const services = await getAllServicesStatus(providerStatus);

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
