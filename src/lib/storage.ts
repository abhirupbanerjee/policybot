import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';

export function getDataDir(): string {
  return DATA_DIR;
}

export function getThreadsDir(): string {
  return path.join(DATA_DIR, 'threads');
}

export function getGlobalDocsDir(): string {
  return path.join(DATA_DIR, 'global-docs');
}

export function getUserThreadsDir(userId: string): string {
  // Sanitize userId to prevent path traversal
  const safeUserId = userId.replace(/[^a-zA-Z0-9@._-]/g, '_');
  return path.join(getThreadsDir(), safeUserId);
}

export function getThreadDir(userId: string, threadId: string): string {
  // Sanitize threadId to prevent path traversal
  const safeThreadId = threadId.replace(/[^a-zA-Z0-9-]/g, '_');
  return path.join(getUserThreadsDir(userId), safeThreadId);
}

export function getThreadUploadsDir(userId: string, threadId: string): string {
  return path.join(getThreadDir(userId, threadId), 'uploads');
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeJson<T>(filePath: string, data: T): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function deleteDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // Directory might not exist, ignore
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // File might not exist, ignore
  }
}

export async function listDirs(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return [];
  }
}

export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isFile()).map(e => e.name);
  } catch {
    return [];
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return stats.size;
}

export async function readFileBuffer(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

export async function writeFileBuffer(filePath: string, buffer: Buffer): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  await fs.writeFile(filePath, buffer);
}

// System prompt storage
export function getConfigDir(): string {
  return path.join(DATA_DIR, 'config');
}

export interface SystemPromptConfig {
  prompt: string;
  updatedAt: string;
  updatedBy: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant for government staff. Your role is to:

1. Answer questions based ONLY on the provided context from organizational documents
2. Consider all document types: policies, design documents, guidelines, standards, and procedures
3. When comparing documents for compliance, clearly identify areas of alignment and gaps
4. Always cite which document and section your answer comes from
5. If the context doesn't contain enough information to answer, say so clearly
6. Be concise, professional, and accurate

When citing sources, use this format: [Document Name, Page X]

If a user asks you to compare their uploaded document against organizational documents:
- Identify specific sections that align with existing documents
- Point out any gaps or areas that don't meet requirements
- Suggest improvements if applicable`;

export async function getSystemPrompt(): Promise<SystemPromptConfig> {
  const configPath = path.join(getConfigDir(), 'system-prompt.json');
  const config = await readJson<SystemPromptConfig>(configPath);

  if (!config) {
    return {
      prompt: DEFAULT_SYSTEM_PROMPT,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
  }

  return config;
}

export async function saveSystemPrompt(prompt: string, updatedBy: string): Promise<SystemPromptConfig> {
  const configPath = path.join(getConfigDir(), 'system-prompt.json');
  const config: SystemPromptConfig = {
    prompt,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await writeJson(configPath, config);
  return config;
}

// RAG Settings
export interface RAGSettings {
  // Retrieval settings
  topKChunks: number;           // Number of chunks to retrieve per query
  maxContextChunks: number;     // Maximum chunks to include in final context
  similarityThreshold: number;  // Minimum similarity score (0-1)

  // Chunking settings
  chunkSize: number;            // Characters per chunk
  chunkOverlap: number;         // Overlap between chunks

  // Query settings
  queryExpansionEnabled: boolean;

  // Cache settings
  cacheEnabled: boolean;
  cacheTTLSeconds: number;

  // Metadata
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_RAG_SETTINGS: Omit<RAGSettings, 'updatedAt' | 'updatedBy'> = {
  topKChunks: 20,              // Increased from 15 - retrieve more candidates
  maxContextChunks: 15,        // Increased from 12 - send more context to LLM
  similarityThreshold: 0.5,    // Increased from 0.3 - higher quality matches
  chunkSize: 800,              // Increased from 500 - preserve more context
  chunkOverlap: 150,           // Increased from 50 - better continuity
  queryExpansionEnabled: true,
  cacheEnabled: true,
  cacheTTLSeconds: 3600,
};

export async function getRAGSettings(): Promise<RAGSettings> {
  const configPath = path.join(getConfigDir(), 'rag-settings.json');
  const config = await readJson<RAGSettings>(configPath);

  if (!config) {
    return {
      ...DEFAULT_RAG_SETTINGS,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
  }

  return config;
}

export async function saveRAGSettings(settings: Omit<RAGSettings, 'updatedAt' | 'updatedBy'>, updatedBy: string): Promise<RAGSettings> {
  const configPath = path.join(getConfigDir(), 'rag-settings.json');
  const config: RAGSettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await writeJson(configPath, config);
  return config;
}

// LLM Settings
export interface LLMSettings {
  model: string;
  temperature: number;
  maxTokens: number;

  // Metadata
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_LLM_SETTINGS: Omit<LLMSettings, 'updatedAt' | 'updatedBy'> = {
  model: 'gpt-5-mini',
  temperature: 0.3,
  maxTokens: 2000,
};

export const AVAILABLE_MODELS = [
  { id: 'gpt-5', name: 'GPT-5', description: 'Most capable, best for complex queries' },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini (Recommended)', description: 'Balanced performance and cost' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Fast and cost-effective' },
];

export async function getLLMSettings(): Promise<LLMSettings> {
  const configPath = path.join(getConfigDir(), 'llm-settings.json');
  const config = await readJson<LLMSettings>(configPath);

  if (!config) {
    return {
      ...DEFAULT_LLM_SETTINGS,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
  }

  return config;
}

export async function saveLLMSettings(settings: Omit<LLMSettings, 'updatedAt' | 'updatedBy'>, updatedBy: string): Promise<LLMSettings> {
  const configPath = path.join(getConfigDir(), 'llm-settings.json');
  const config: LLMSettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await writeJson(configPath, config);
  return config;
}

// Acronym Mappings
export interface AcronymMappings {
  mappings: Record<string, string>;
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_ACRONYM_MAPPINGS: Record<string, string> = {
  'ea': 'enterprise architecture',
  'dta': 'digital transformation agency',
  'it': 'information technology',
  'ict': 'information and communication technology',
  'hr': 'human resources',
  'kpi': 'key performance indicator',
  'sla': 'service level agreement',
};

export async function getAcronymMappings(): Promise<AcronymMappings> {
  const configPath = path.join(getConfigDir(), 'acronym-mappings.json');
  const config = await readJson<AcronymMappings>(configPath);

  if (!config) {
    return {
      mappings: DEFAULT_ACRONYM_MAPPINGS,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
  }

  return config;
}

export async function saveAcronymMappings(mappings: Record<string, string>, updatedBy: string): Promise<AcronymMappings> {
  const configPath = path.join(getConfigDir(), 'acronym-mappings.json');
  const config: AcronymMappings = {
    mappings,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await writeJson(configPath, config);
  return config;
}

// Tavily Settings
export interface TavilySettings {
  apiKey: string;
  enabled: boolean;
  defaultTopic: 'general' | 'news' | 'finance';
  defaultSearchDepth: 'basic' | 'advanced';
  maxResults: number;
  includeDomains: string[];
  excludeDomains: string[];
  cacheTTLSeconds: number;
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_TAVILY_SETTINGS: Omit<TavilySettings, 'updatedAt' | 'updatedBy'> = {
  apiKey: '',
  enabled: false,  // Disabled by default
  defaultTopic: 'general',
  defaultSearchDepth: 'basic',
  maxResults: 5,
  includeDomains: [],
  excludeDomains: [],
  cacheTTLSeconds: 1800, // 30 minutes (web results more time-sensitive than RAG)
};

export async function getTavilySettings(): Promise<TavilySettings> {
  const configPath = path.join(getConfigDir(), 'tavily-settings.json');
  const config = await readJson<TavilySettings>(configPath);

  if (!config) {
    return {
      ...DEFAULT_TAVILY_SETTINGS,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
  }

  return config;
}

export async function saveTavilySettings(settings: Omit<TavilySettings, 'updatedAt' | 'updatedBy'>, updatedBy: string): Promise<TavilySettings> {
  const configPath = path.join(getConfigDir(), 'tavily-settings.json');
  const config: TavilySettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await writeJson(configPath, config);
  return config;
}

// Helper function to ensure directory exists (used by write operations)
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  await ensureDir(dirPath);
}
