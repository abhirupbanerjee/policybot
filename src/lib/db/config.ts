/**
 * Configuration Database Operations
 *
 * Key-value settings store with fallback to JSON config files
 * Priority: SQLite > JSON config > Hardcoded defaults
 */

import { execute, queryOne } from './index';
import {
  loadConfig,
  loadSystemPrompt,
  getModelPresetsFromConfig,
  getDefaultPresetId,
  getSystemPromptFileHash,
  type ModelPresetConfig,
} from '../config-loader';

// ============ Types ============

export interface RagSettings {
  topKChunks: number;
  maxContextChunks: number;
  similarityThreshold: number;
  chunkSize: number;
  chunkOverlap: number;
  queryExpansionEnabled: boolean;
  cacheEnabled: boolean;
  cacheTTLSeconds: number;
}

export interface LlmSettings {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface TavilySettings {
  apiKey?: string;  // Stored encrypted, falls back to TAVILY_API_KEY env var
  enabled: boolean;
  defaultTopic: 'general' | 'news' | 'finance';
  defaultSearchDepth: 'basic' | 'advanced';
  maxResults: number;
  includeDomains: string[];
  excludeDomains: string[];
  cacheTTLSeconds: number;
}

export interface UploadLimits {
  maxFilesPerInput: number;
  maxFileSizeMB: number;
  allowedTypes: string[];
}

export interface SystemPrompt {
  content: string;
  fileHash?: string;  // Hash of system-prompt.md when this was saved
}

export interface RetentionSettings {
  threadRetentionDays: number;
  storageAlertThreshold: number;
}

export type AcronymMappings = Record<string, string[]>;

export interface BrandingSettings {
  botName: string;
  botIcon: string;
}

export interface EmbeddingSettings {
  model: string;        // e.g., 'text-embedding-3-large'
  dimensions: number;   // e.g., 3072
}

export interface RerankerSettings {
  enabled: boolean;
  provider: 'cohere' | 'local';   // Toggle between Cohere API and local @xenova/transformers
  topKForReranking: number;       // How many chunks to rerank (default: 50)
  minRerankerScore: number;       // Threshold 0-1 (default: 0.3)
  cacheTTLSeconds: number;        // Cache duration (default: 3600)
}

export interface MemorySettings {
  enabled: boolean;               // Enable/disable memory system
  extractionThreshold: number;    // Minimum messages before extracting facts
  maxFactsPerCategory: number;    // Maximum facts stored per user+category
  autoExtractOnThreadEnd: boolean; // Auto-extract facts when thread ends
}

export interface SummarizationSettings {
  enabled: boolean;               // Enable/disable auto-summarization
  tokenThreshold: number;         // Trigger summarization when thread exceeds this
  keepRecentMessages: number;     // Number of recent messages to preserve unsummarized
  summaryMaxTokens: number;       // Maximum length of generated summary
  archiveOriginalMessages: boolean; // Keep original messages for audit/recovery
}

// Available icon options for branding
export const BRANDING_ICONS = [
  { key: 'government', label: 'Government', lucideIcon: 'Landmark' },
  { key: 'operations', label: 'Operations', lucideIcon: 'Settings' },
  { key: 'finance', label: 'Finance', lucideIcon: 'DollarSign' },
  { key: 'kpi', label: 'KPI', lucideIcon: 'BarChart3' },
  { key: 'logs', label: 'Logs', lucideIcon: 'FileText' },
  { key: 'data', label: 'Data', lucideIcon: 'Database' },
  { key: 'monitoring', label: 'Monitoring', lucideIcon: 'Activity' },
  { key: 'architecture', label: 'Architecture', lucideIcon: 'Layers' },
  { key: 'internet', label: 'Internet', lucideIcon: 'Globe' },
  { key: 'systems', label: 'Systems', lucideIcon: 'Server' },
  { key: 'policy', label: 'Policy', lucideIcon: 'ScrollText' },
] as const;

// ============ Preset Configurations ============

export interface ModelPreset {
  id: string;
  name: string;
  description: string;
  model: string;
  llmSettings: LlmSettings;
  ragSettings: RagSettings;
}

/**
 * Convert config preset to ModelPreset format
 */
function configToPreset(id: string, config: ModelPresetConfig): ModelPreset {
  return {
    id,
    name: config.name,
    description: config.description,
    model: id,
    llmSettings: {
      model: id,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    },
    ragSettings: {
      topKChunks: config.topKChunks,
      maxContextChunks: config.maxContextChunks,
      similarityThreshold: config.similarityThreshold,
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
      queryExpansionEnabled: config.queryExpansionEnabled,
      cacheEnabled: config.cacheEnabled,
      cacheTTLSeconds: config.cacheTTLSeconds,
    },
  };
}

/**
 * Get model presets from JSON config
 * Falls back to hardcoded defaults if config unavailable
 */
export function getModelPresets(): ModelPreset[] {
  const configPresets = getModelPresetsFromConfig();
  return Object.entries(configPresets).map(([id, config]) => configToPreset(id, config));
}

// For backward compatibility - lazy loaded from config
let _cachedPresets: ModelPreset[] | null = null;
export const MODEL_PRESETS: ModelPreset[] = new Proxy([] as ModelPreset[], {
  get(_target, prop) {
    if (_cachedPresets === null) {
      _cachedPresets = getModelPresets();
    }
    if (prop === 'length') return _cachedPresets.length;
    if (typeof prop === 'string' && !isNaN(Number(prop))) {
      return _cachedPresets[Number(prop)];
    }
    if (prop === Symbol.iterator) {
      return function* () {
        for (const preset of _cachedPresets!) yield preset;
      };
    }
    return Reflect.get(_cachedPresets, prop);
  },
});

// Default preset ID (loaded from config)
export const DEFAULT_PRESET_ID = getDefaultPresetId();

// Setting keys
export type SettingKey =
  | 'rag-settings'
  | 'llm-settings'
  | 'tavily-settings'
  | 'upload-limits'
  | 'system-prompt'
  | 'acronym-mappings'
  | 'retention-settings'
  | 'branding-settings'
  | 'embedding-settings'
  | 'reranker-settings'
  | 'memory-settings'
  | 'summarization-settings';

// ============ Generic Operations ============

interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Get a setting by key
 */
export function getSetting<T>(key: SettingKey): T | undefined {
  const row = queryOne<SettingRow>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  if (!row) return undefined;

  try {
    return JSON.parse(row.value) as T;
  } catch {
    return undefined;
  }
}

/**
 * Set a setting value
 */
export function setSetting<T>(key: SettingKey, value: T, updatedBy?: string): void {
  execute(`
    INSERT INTO settings (key, value, updated_by, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `, [key, JSON.stringify(value), updatedBy || null]);
}

/**
 * Delete a setting (reset to config default)
 */
export function deleteSetting(key: SettingKey): void {
  execute('DELETE FROM settings WHERE key = ?', [key]);
}

/**
 * Get setting metadata (without parsing value)
 */
export function getSettingMetadata(key: SettingKey): {
  updatedAt: string;
  updatedBy: string | null;
} | undefined {
  const row = queryOne<SettingRow>(
    'SELECT updated_at, updated_by FROM settings WHERE key = ?',
    [key]
  );
  if (!row) return undefined;

  return {
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

// ============ Typed Getters ============

/**
 * Get RAG settings
 * Priority: SQLite > JSON config > hardcoded defaults
 */
export function getRagSettings(): RagSettings {
  const dbSettings = getSetting<RagSettings>('rag-settings');
  if (dbSettings) return dbSettings;

  // Fall back to JSON config
  const config = loadConfig();
  return config.rag;
}

/**
 * Get LLM settings
 * Priority: SQLite > JSON config > hardcoded defaults
 */
export function getLlmSettings(): LlmSettings {
  const dbSettings = getSetting<LlmSettings>('llm-settings');
  if (dbSettings) return dbSettings;

  // Fall back to JSON config
  const config = loadConfig();
  return config.llm;
}

/**
 * Get Tavily settings
 * Priority: SQLite > JSON config > hardcoded defaults
 */
export function getTavilySettings(): TavilySettings {
  const dbSettings = getSetting<TavilySettings>('tavily-settings');
  if (dbSettings) return dbSettings;

  // Fall back to JSON config
  const config = loadConfig();
  return config.tavily;
}

/**
 * Get upload limits
 * Priority: SQLite > JSON config > hardcoded defaults
 */
export function getUploadLimits(): UploadLimits {
  const dbSettings = getSetting<UploadLimits>('upload-limits');
  if (dbSettings) return dbSettings;

  // Fall back to JSON config
  const config = loadConfig();
  return config.upload;
}

/**
 * Get system prompt
 * Priority: SQLite > JSON config (system-prompt.md) > hardcoded defaults
 *
 * Auto-syncs with file: If system-prompt.md has changed since the SQLite
 * value was saved (detected via hash), the SQLite entry is cleared and
 * the new file content is used. This ensures builds with updated prompts
 * automatically take effect.
 */
export function getSystemPrompt(): string {
  const setting = getSetting<SystemPrompt>('system-prompt');

  if (setting?.content) {
    // Check if the config file has changed since this prompt was saved
    const currentFileHash = getSystemPromptFileHash();

    if (setting.fileHash && setting.fileHash !== currentFileHash) {
      // File has changed - clear SQLite to use new file version
      console.log('[Config] System prompt file changed (hash mismatch), syncing to new version');
      deleteSetting('system-prompt');
      return loadSystemPrompt();
    }

    return setting.content;
  }

  // Fall back to JSON config (loads from system-prompt.md)
  return loadSystemPrompt();
}

/**
 * Get acronym mappings
 * Priority: SQLite > JSON config > empty
 */
export function getAcronymMappings(): AcronymMappings {
  const dbSettings = getSetting<AcronymMappings>('acronym-mappings');
  if (dbSettings) return dbSettings;

  // Fall back to JSON config (convert string values to string[] for compatibility)
  const config = loadConfig();
  const mappings: AcronymMappings = {};
  for (const [key, value] of Object.entries(config.acronyms)) {
    mappings[key] = [value];
  }
  return mappings;
}

/**
 * Get retention settings
 * Priority: SQLite > JSON config > hardcoded defaults
 */
export function getRetentionSettings(): RetentionSettings {
  const dbSettings = getSetting<RetentionSettings>('retention-settings');
  if (dbSettings) return dbSettings;

  // Fall back to JSON config
  const config = loadConfig();
  return config.retention;
}

/**
 * Get branding settings
 * Priority: SQLite > JSON config > hardcoded defaults
 */
export function getBrandingSettings(): BrandingSettings {
  const dbSettings = getSetting<BrandingSettings>('branding-settings');
  if (dbSettings) return dbSettings;

  // Fall back to JSON config
  const config = loadConfig();
  return config.branding;
}

/**
 * Get embedding settings
 * Priority: SQLite > JSON config > hardcoded defaults
 */
export function getEmbeddingSettings(): EmbeddingSettings {
  const dbSettings = getSetting<EmbeddingSettings>('embedding-settings');
  if (dbSettings) return dbSettings;

  // Fall back to JSON config
  const config = loadConfig();
  return config.embedding;
}

/**
 * Get reranker settings
 * Priority: SQLite > JSON config > hardcoded defaults
 */
export function getRerankerSettings(): RerankerSettings {
  const dbSettings = getSetting<RerankerSettings>('reranker-settings');
  if (dbSettings) return dbSettings;

  // Fall back to JSON config
  const config = loadConfig();
  return config.reranker;
}

/**
 * Get memory settings
 * Priority: SQLite > JSON config > hardcoded defaults
 */
export function getMemorySettings(): MemorySettings {
  const dbSettings = getSetting<MemorySettings>('memory-settings');
  if (dbSettings) return dbSettings;

  // Fall back to JSON config
  const config = loadConfig();
  return config.memory || {
    enabled: false,
    extractionThreshold: 5,
    maxFactsPerCategory: 20,
    autoExtractOnThreadEnd: true,
  };
}

/**
 * Get summarization settings
 * Priority: SQLite > JSON config > hardcoded defaults
 */
export function getSummarizationSettings(): SummarizationSettings {
  const dbSettings = getSetting<SummarizationSettings>('summarization-settings');
  if (dbSettings) return dbSettings;

  // Fall back to JSON config
  const config = loadConfig();
  return config.summarization || {
    enabled: false,
    tokenThreshold: 100000,
    keepRecentMessages: 10,
    summaryMaxTokens: 2000,
    archiveOriginalMessages: true,
  };
}

// ============ Typed Setters ============

/**
 * Update RAG settings
 */
export function setRagSettings(settings: Partial<RagSettings>, updatedBy?: string): RagSettings {
  const current = getRagSettings();
  const updated = { ...current, ...settings };
  setSetting('rag-settings', updated, updatedBy);
  return updated;
}

/**
 * Update LLM settings
 */
export function setLlmSettings(settings: Partial<LlmSettings>, updatedBy?: string): LlmSettings {
  const current = getLlmSettings();
  const updated = { ...current, ...settings };
  setSetting('llm-settings', updated, updatedBy);
  return updated;
}

/**
 * Update Tavily settings
 */
export function setTavilySettings(settings: Partial<TavilySettings>, updatedBy?: string): TavilySettings {
  const current = getTavilySettings();
  const updated = { ...current, ...settings };
  setSetting('tavily-settings', updated, updatedBy);
  return updated;
}

/**
 * Update upload limits
 */
export function setUploadLimits(limits: Partial<UploadLimits>, updatedBy?: string): UploadLimits {
  const current = getUploadLimits();
  const updated = { ...current, ...limits };
  setSetting('upload-limits', updated, updatedBy);
  return updated;
}

/**
 * Update system prompt
 * Stores the current file hash so we can detect when the file changes
 */
export function setSystemPrompt(content: string, updatedBy?: string): void {
  const fileHash = getSystemPromptFileHash();
  setSetting('system-prompt', { content, fileHash }, updatedBy);
}

/**
 * Update acronym mappings
 */
export function setAcronymMappings(mappings: AcronymMappings, updatedBy?: string): void {
  setSetting('acronym-mappings', mappings, updatedBy);
}

/**
 * Update retention settings
 */
export function setRetentionSettings(settings: Partial<RetentionSettings>, updatedBy?: string): RetentionSettings {
  const current = getRetentionSettings();
  const updated = { ...current, ...settings };
  setSetting('retention-settings', updated, updatedBy);
  return updated;
}

/**
 * Update branding settings
 */
export function setBrandingSettings(settings: Partial<BrandingSettings>, updatedBy?: string): BrandingSettings {
  const current = getBrandingSettings();
  const updated = { ...current, ...settings };
  setSetting('branding-settings', updated, updatedBy);
  return updated;
}

/**
 * Update embedding settings
 */
export function setEmbeddingSettings(settings: Partial<EmbeddingSettings>, updatedBy?: string): EmbeddingSettings {
  const current = getEmbeddingSettings();
  const updated = { ...current, ...settings };
  setSetting('embedding-settings', updated, updatedBy);
  return updated;
}

/**
 * Update reranker settings
 */
export function setRerankerSettings(settings: Partial<RerankerSettings>, updatedBy?: string): RerankerSettings {
  const current = getRerankerSettings();
  const updated = { ...current, ...settings };
  setSetting('reranker-settings', updated, updatedBy);
  return updated;
}

/**
 * Update memory settings
 */
export function setMemorySettings(settings: Partial<MemorySettings>, updatedBy?: string): MemorySettings {
  const current = getMemorySettings();
  const updated = { ...current, ...settings };
  setSetting('memory-settings', updated, updatedBy);
  return updated;
}

/**
 * Update summarization settings
 */
export function setSummarizationSettings(settings: Partial<SummarizationSettings>, updatedBy?: string): SummarizationSettings {
  const current = getSummarizationSettings();
  const updated = { ...current, ...settings };
  setSetting('summarization-settings', updated, updatedBy);
  return updated;
}

// ============ Default System Prompt ============

/**
 * Get default system prompt from config file
 * This is used when no custom prompt is set in SQLite
 */
export function getDefaultSystemPrompt(): string {
  return loadSystemPrompt();
}

// ============ Bulk Operations ============

/**
 * Get all settings as a combined object
 */
export function getAllSettings(): {
  rag: RagSettings;
  llm: LlmSettings;
  tavily: TavilySettings;
  uploadLimits: UploadLimits;
  systemPrompt: string;
  acronymMappings: AcronymMappings;
  retention: RetentionSettings;
  branding: BrandingSettings;
  embedding: EmbeddingSettings;
  reranker: RerankerSettings;
  memory: MemorySettings;
  summarization: SummarizationSettings;
} {
  return {
    rag: getRagSettings(),
    llm: getLlmSettings(),
    tavily: getTavilySettings(),
    uploadLimits: getUploadLimits(),
    systemPrompt: getSystemPrompt(),
    acronymMappings: getAcronymMappings(),
    retention: getRetentionSettings(),
    branding: getBrandingSettings(),
    embedding: getEmbeddingSettings(),
    reranker: getRerankerSettings(),
    memory: getMemorySettings(),
    summarization: getSummarizationSettings(),
  };
}
