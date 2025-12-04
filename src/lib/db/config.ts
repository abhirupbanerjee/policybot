/**
 * Configuration Database Operations
 *
 * Key-value settings store that replaces JSON config files
 * Supports typed settings retrieval and updates
 */

import { execute, queryOne } from './index';

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
  enabled: boolean;
  defaultTopic: 'general' | 'news' | 'finance';
  defaultSearchDepth: 'basic' | 'advanced';
  maxResults: number;
  includeDomains: string[];
  excludeDomains: string[];
  cacheTTLSeconds: number;
}

export interface UploadLimits {
  maxFilesPerThread: number;
  maxFileSizeMB: number;
  allowedTypes: string[];
}

export interface SystemPrompt {
  content: string;
}

export interface RetentionSettings {
  threadRetentionDays: number;
  storageAlertThreshold: number;
}

export type AcronymMappings = Record<string, string[]>;

// Setting keys
export type SettingKey =
  | 'rag-settings'
  | 'llm-settings'
  | 'tavily-settings'
  | 'upload-limits'
  | 'system-prompt'
  | 'acronym-mappings'
  | 'retention-settings';

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
 */
export function getRagSettings(): RagSettings {
  return getSetting<RagSettings>('rag-settings') || {
    topKChunks: 20,
    maxContextChunks: 15,
    similarityThreshold: 0.5,
    chunkSize: 800,
    chunkOverlap: 150,
    queryExpansionEnabled: true,
    cacheEnabled: true,
    cacheTTLSeconds: 3600,
  };
}

/**
 * Get LLM settings
 */
export function getLlmSettings(): LlmSettings {
  return getSetting<LlmSettings>('llm-settings') || {
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 2000,
  };
}

/**
 * Get Tavily settings
 */
export function getTavilySettings(): TavilySettings {
  return getSetting<TavilySettings>('tavily-settings') || {
    enabled: false,
    defaultTopic: 'general',
    defaultSearchDepth: 'basic',
    maxResults: 5,
    includeDomains: [],
    excludeDomains: [],
    cacheTTLSeconds: 3600,
  };
}

/**
 * Get upload limits
 */
export function getUploadLimits(): UploadLimits {
  return getSetting<UploadLimits>('upload-limits') || {
    maxFilesPerThread: 5,
    maxFileSizeMB: 10,
    allowedTypes: ['application/pdf'],
  };
}

/**
 * Get system prompt
 */
export function getSystemPrompt(): string {
  const setting = getSetting<SystemPrompt>('system-prompt');
  return setting?.content || getDefaultSystemPrompt();
}

/**
 * Get acronym mappings
 */
export function getAcronymMappings(): AcronymMappings {
  return getSetting<AcronymMappings>('acronym-mappings') || {};
}

/**
 * Get retention settings
 */
export function getRetentionSettings(): RetentionSettings {
  return getSetting<RetentionSettings>('retention-settings') || {
    threadRetentionDays: 90,
    storageAlertThreshold: 70,
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
 */
export function setSystemPrompt(content: string, updatedBy?: string): void {
  setSetting('system-prompt', { content }, updatedBy);
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

// ============ Default System Prompt ============

function getDefaultSystemPrompt(): string {
  return `You are a helpful assistant that answers questions based on the provided knowledge base documents.

Guidelines:
- Only answer questions using information from the provided context
- If the information is not in the context, say so clearly
- Always cite your sources with document names and page numbers
- Use markdown formatting for better readability
- Be concise but thorough`;
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
} {
  return {
    rag: getRagSettings(),
    llm: getLlmSettings(),
    tavily: getTavilySettings(),
    uploadLimits: getUploadLimits(),
    systemPrompt: getSystemPrompt(),
    acronymMappings: getAcronymMappings(),
    retention: getRetentionSettings(),
  };
}
