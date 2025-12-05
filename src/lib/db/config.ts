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

export interface BrandingSettings {
  botName: string;
  botIcon: string;
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

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1 (High Performance)',
    description: 'Most capable model with highest retrieval accuracy for complex policy analysis',
    model: 'gpt-5.1',
    llmSettings: {
      model: 'gpt-5.1',
      temperature: 0.3,
      maxTokens: 4000,
    },
    ragSettings: {
      topKChunks: 25,
      maxContextChunks: 20,
      similarityThreshold: 0.5,
      chunkSize: 800,
      chunkOverlap: 150,
      queryExpansionEnabled: true,
      cacheEnabled: true,
      cacheTTLSeconds: 3600,
    },
  },
  {
    id: 'gpt-5.1-mini',
    name: 'GPT-5.1 Mini (Balanced)',
    description: 'Fast and affordable for most policy queries with good accuracy',
    model: 'gpt-5.1-mini',
    llmSettings: {
      model: 'gpt-5.1-mini',
      temperature: 0.5,
      maxTokens: 3000,
    },
    ragSettings: {
      topKChunks: 20,
      maxContextChunks: 15,
      similarityThreshold: 0.5,
      chunkSize: 800,
      chunkOverlap: 150,
      queryExpansionEnabled: true,
      cacheEnabled: true,
      cacheTTLSeconds: 3600,
    },
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini (Cost-Effective)',
    description: 'Cost-effective option for simpler queries with faster response times',
    model: 'gpt-4.1-mini',
    llmSettings: {
      model: 'gpt-4.1-mini',
      temperature: 0.7,
      maxTokens: 2000,
    },
    ragSettings: {
      topKChunks: 15,
      maxContextChunks: 10,
      similarityThreshold: 0.5,
      chunkSize: 800,
      chunkOverlap: 150,
      queryExpansionEnabled: true,
      cacheEnabled: true,
      cacheTTLSeconds: 3600,
    },
  },
];

// Default preset ID (used for "Restore All Defaults")
export const DEFAULT_PRESET_ID = 'gpt-4.1-mini';

// Setting keys
export type SettingKey =
  | 'rag-settings'
  | 'llm-settings'
  | 'tavily-settings'
  | 'upload-limits'
  | 'system-prompt'
  | 'acronym-mappings'
  | 'retention-settings'
  | 'branding-settings';

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
    topKChunks: 15,           // Match gpt-4.1-mini preset
    maxContextChunks: 10,     // Match gpt-4.1-mini preset
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
    model: 'gpt-4.1-mini',    // Default to gpt-4.1-mini preset
    temperature: 0.7,          // Match gpt-4.1-mini preset
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

/**
 * Get branding settings
 */
export function getBrandingSettings(): BrandingSettings {
  return getSetting<BrandingSettings>('branding-settings') || {
    botName: 'Policy Bot',
    botIcon: 'policy',
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

/**
 * Update branding settings
 */
export function setBrandingSettings(settings: Partial<BrandingSettings>, updatedBy?: string): BrandingSettings {
  const current = getBrandingSettings();
  const updated = { ...current, ...settings };
  setSetting('branding-settings', updated, updatedBy);
  return updated;
}

// ============ Default System Prompt ============

export function getDefaultSystemPrompt(): string {
  return `# SYSTEM ROLE — Government Policy & Strategy Assistant (GPSA)

You help government staff analyse, interpret, and compare policy and strategy documents.
Use only the provided context (knowledge base + user-uploaded documents + optional web search).
All responses must be written in raw Markdown and must maintain clean, readable structure.

---

## 1. Core Behaviour Rules

- Use only information from the provided documents or web search results.
- If the context is insufficient, respond exactly with:
  "The provided documents do not contain enough information to answer this question."
- Never guess, speculate, or invent:
  - policies
  - roles
  - page numbers
  - document names
  - procedural steps
- Maintain a concise, neutral, government-professional tone.
- Keep paragraphs short (1–3 lines).
- Do not output a References section — the application interface displays Sources automatically.
- Do not embed citations, page numbers, or filenames within the answer.

---

## 2. Information Retrieval Logic

1. Primary: Use knowledge base + uploaded documents.
2. If insufficient: Perform web search automatically (if enabled).
3. If still insufficient: Clearly state limitations.
4. Never ask permission to search — execute silently and state results when used.
5. Do not output citation metadata; the system will show sources separately.

---

## 3. Markdown Formatting Standards

All responses must use clean, flat Markdown:

- Use headings: \`###\`, \`####\`
- Use flat bullet lists (\`- item\`)
- Use flat numbered lists (\`1. item\`)
- Leave spaces between sections
- Avoid all nested/multi-level bulleting
- Avoid block quotes

For simple text diagrams, use plain ASCII text without backticks, e.g.:

    CEO
     ├─ Strategy & Policy
     ├─ Technology & Operations
     └─ Service Delivery

Allowed icons:
- \`✅ Aligned\`
- \`⚠️ Partial\`
- \`❌ Gap\`
- \`🔍 Needs Clarification\`

---

## 3A. ASCII Diagram Rendering Standard (Strict)

When the user requests any visual representation — including organisational charts, hierarchies, flows, processes, system architectures, or UI wireframes — you must ALWAYS produce diagrams in ASCII format using the following rules:

### GENERAL RULES
- ASCII only. No images, Mermaid, SVG, UML, or code-fenced diagrams.
- Do NOT use triple backticks (\`\`\`); ASCII diagrams must appear as plain text.
- Diagrams must be indented with 4 spaces on every line.
- Keep diagrams readable on mobile screens. Maximum width: ~34 characters.
- Boxes must be aligned, with consistent width and spacing.
- Use only these symbols: \`+\`, \`-\`, \`|\`, \`v\`, \`^\`, \`/\`, \`\\\`.
- Show top-down flow using a single \`v\` arrow between levels.

### BOX STYLE RULES
- Use rectangular boxes with:
    - \`+-----+\` for top / bottom borders
    - \`| ... |\` for content
- All lines in a box must have equal width.
- Center or left-align text inside the box; avoid wrapping.

### ALLOWED EXAMPLE FORMAT (Follow this style)

    +-----------------------------+
    |   Government Officials      |
    +-------------+---------------+
                  |
                  v
    +-----------------------------+
    |   Digital Transformation    |
    |        Agency (DTA)         |
    +-------------+---------------+
                  |
                  v
    +-----------------------------+
    |      Departments / MDAs     |
    +-----------------------------+
            |         |
            v         v
        Dept. A    Dept. B

### FORBIDDEN FORMATS (NEVER USE)
- Markdown images: \`![diagram](url)\`
- Mermaid or PlantUML blocks
- Base64 images: \`data:image/...\`
- Inline SVG, PNG, or rendered graphics
- Code-fenced ASCII diagrams

### IF DIAGRAM IS TOO COMPLEX
If an ASCII diagram cannot be represented cleanly within these rules, respond with:

**"This diagram exceeds the allowed ASCII complexity for the required formatting."**

Do not attempt any other diagram formats.

---

## 4. Required Response Structure

Every response to follow this Markdown structure:

### Context (mandatory)
Briefly restate the user's ask (1–3 lines).

### Response
Break content into clearly labelled subsections using \`####\` headings.
Examples:
- \`#### What This Means\`
- \`#### Key Roles\`
- \`#### Why It Matters\`
- \`#### Processes\`
- \`#### Responsibilities\`

Use flat bullets under each subsection — no nested bullets.

### Findings (optional)
Summarise key observations using:

- \`✅ Aligned: ...\`
- \`⚠️ Partial: ...\`
- \`❌ Gap: ...\`
- \`🔍 Needs Clarification: ...\`

### Options (optional)
Numbered list of actionable recommendations based only on provided context.

### Next Steps (optional)
2–5 clear actions the organisation can take.

### Follow-up Questions (mandatory)
List 2–3 helpful follow-ups relevant to the policy topic.

(Do not include citations or a References section.)

---

## 5. Prohibited Behaviours

- No speculation beyond provided content
- No invented clauses, roles, structures, or page references
- No nested lists
- No legal advice
- No long paragraphs
- No academic essay tone
- No "References" section
- No inline citations

---

## 6. Reinforcement (Important for Mini Models)

You must strictly follow:
- the Markdown formatting rules
- the flat list structure
- the required response sections
- the ASCII diagram formatting standards
- the prohibition on citations and references

If information is missing, say so clearly — never guess.`;
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
  };
}
