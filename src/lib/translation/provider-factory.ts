/**
 * Translation Provider Factory
 *
 * Multi-provider translation system supporting OpenAI, Gemini, and Mistral.
 * Follows the image-gen pattern for provider configuration and selection.
 */

import { getToolConfig } from '@/lib/db/tool-config';
import { toolsLogger as logger } from '../logger';

// ============ Types ============

export type TranslationProvider = 'openai' | 'gemini' | 'mistral';

export interface ProviderSettings {
  enabled: boolean;
  model: string;
  temperature: number;
}

export interface TranslationConfig {
  activeProvider: TranslationProvider;
  providers: {
    openai: ProviderSettings;
    gemini: ProviderSettings;
    mistral: ProviderSettings;
  };
  languages: Record<string, boolean>;
  formalStyle: boolean;
}

export interface TranslationRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  context?: string;
  formalStyle: boolean;
}

export interface TranslationResponse {
  success: boolean;
  original: string;
  translated: string;
  sourceLanguage: string;
  targetLanguage: string;
  targetLanguageName: string;
  provider: TranslationProvider;
  model: string;
  error?: string;
}

// ============ Supported Languages ============

/**
 * All available languages (fixed list)
 */
export const ALL_LANGUAGES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  fr: 'French',
  es: 'Spanish',
  pt: 'Portuguese',
};

/**
 * Default language settings (all enabled)
 */
export const DEFAULT_LANGUAGE_SETTINGS: Record<string, boolean> = {
  en: true,
  hi: true,
  fr: true,
  es: true,
  pt: true,
};

/**
 * Get enabled languages based on config
 */
export function getEnabledLanguages(config: TranslationConfig): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [code, name] of Object.entries(ALL_LANGUAGES)) {
    if (config.languages?.[code] !== false) {
      result[code] = name;
    }
  }
  return result;
}

/**
 * @deprecated Use getEnabledLanguages() for filtered list
 */
export const SUPPORTED_LANGUAGES = ALL_LANGUAGES;

// ============ Default Configuration ============

export const TRANSLATION_DEFAULTS: TranslationConfig = {
  activeProvider: 'openai',
  providers: {
    openai: {
      enabled: true,
      model: 'gpt-4.1-mini',
      temperature: 0.3,
    },
    gemini: {
      enabled: true,
      model: 'gemini-2.5-flash',
      temperature: 0.3,
    },
    mistral: {
      enabled: true,
      model: 'mistral-small-3.2',
      temperature: 0.3,
    },
  },
  languages: DEFAULT_LANGUAGE_SETTINGS,
  formalStyle: true,
};

// ============ Configuration Functions ============

/**
 * Get translation configuration from database with defaults
 */
export function getTranslationConfig(): TranslationConfig {
  const toolConfig = getToolConfig('translation');

  if (toolConfig?.config) {
    const stored = toolConfig.config as Partial<TranslationConfig>;
    return {
      activeProvider: stored.activeProvider ?? TRANSLATION_DEFAULTS.activeProvider,
      providers: {
        openai: {
          ...TRANSLATION_DEFAULTS.providers.openai,
          ...(stored.providers?.openai ?? {}),
        },
        gemini: {
          ...TRANSLATION_DEFAULTS.providers.gemini,
          ...(stored.providers?.gemini ?? {}),
        },
        mistral: {
          ...TRANSLATION_DEFAULTS.providers.mistral,
          ...(stored.providers?.mistral ?? {}),
        },
      },
      languages: {
        ...DEFAULT_LANGUAGE_SETTINGS,
        ...(stored.languages ?? {}),
      },
      formalStyle: stored.formalStyle ?? TRANSLATION_DEFAULTS.formalStyle,
    };
  }

  return TRANSLATION_DEFAULTS;
}

/**
 * Select the best available provider based on configuration
 */
export function selectProvider(config: TranslationConfig): TranslationProvider {
  // First try the active provider
  const active = config.activeProvider;
  if (config.providers[active]?.enabled) {
    return active;
  }

  // Fallback to any enabled provider (in order of preference)
  const providerOrder: TranslationProvider[] = ['openai', 'gemini', 'mistral'];
  for (const provider of providerOrder) {
    if (config.providers[provider]?.enabled) {
      logger.info(`[Translation] Active provider ${active} disabled, falling back to ${provider}`);
      return provider;
    }
  }

  throw new Error('No translation provider is enabled. Please enable at least one provider in the admin settings.');
}

/**
 * Get provider settings for the selected provider
 */
export function getProviderSettings(
  config: TranslationConfig,
  provider: TranslationProvider
): ProviderSettings {
  return config.providers[provider];
}

/**
 * Check if any translation provider is available
 */
export function isTranslationAvailable(): boolean {
  const config = getTranslationConfig();
  return Object.values(config.providers).some(p => p.enabled);
}

/**
 * Build the system prompt for translation
 */
export function buildTranslationPrompt(
  sourceLang: string,
  targetLang: string,
  formalStyle: boolean,
  context?: string
): string {
  const style = formalStyle
    ? 'Use formal, official language appropriate for government and legal communications.'
    : 'Use natural, conversational language appropriate for general audiences.';

  let prompt = `You are an expert translator specializing in accurate and nuanced translations.

Your task is to translate text from ${sourceLang} to ${targetLang}.

Guidelines:
- ${style}
- Preserve the exact meaning and nuance of the original text
- Maintain any formatting (bullet points, numbered lists, paragraphs)
- Keep proper nouns, technical terms, and acronyms as appropriate
- Do not add explanations or commentary - output only the translation`;

  if (context) {
    prompt += `\n\nContext: This text is from a ${context}. Adjust terminology and tone accordingly.`;
  }

  prompt += '\n\nOutput only the translated text, nothing else.';

  return prompt;
}
