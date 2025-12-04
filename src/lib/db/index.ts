/**
 * SQLite Database Connection and Initialization
 *
 * Provides a singleton database connection with:
 * - Automatic initialization from schema.sql
 * - Connection pooling via better-sqlite3
 * - Default settings initialization
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

// Database file path
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(DATA_DIR, 'policybot.db');

// Singleton database instance
let db: Database.Database | null = null;

/**
 * Get or create the database connection
 */
export function getDatabase(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Create database connection
  db = new Database(DB_PATH);

  // Enable foreign keys and WAL mode for better concurrency
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // Initialize schema
  initializeSchema(db);

  // Initialize default settings
  initializeDefaultSettings(db);

  return db;
}

/**
 * Initialize database schema from schema.sql
 */
function initializeSchema(database: Database.Database): void {
  // Try multiple paths for schema.sql (works in both dev and production)
  const possiblePaths = [
    path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql'),
    path.join(process.cwd(), '.next', 'server', 'lib', 'db', 'schema.sql'),
    path.join(__dirname, 'schema.sql'),
  ];

  let schema: string | null = null;
  for (const schemaPath of possiblePaths) {
    if (fs.existsSync(schemaPath)) {
      schema = fs.readFileSync(schemaPath, 'utf-8');
      break;
    }
  }

  if (!schema) {
    // Inline schema as fallback
    schema = getInlineSchema();
  }

  database.exec(schema);
}

/**
 * Inline schema as fallback when file is not accessible
 */
function getInlineSchema(): string {
  return `
-- Users & Roles
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'superuser', 'user')),
  added_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- Super user category assignments
CREATE TABLE IF NOT EXISTS super_user_categories (
  user_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  assigned_by TEXT NOT NULL,
  PRIMARY KEY (user_id, category_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- User category subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  subscribed_by TEXT NOT NULL,
  PRIMARY KEY (user_id, category_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_category ON user_subscriptions(category_id);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  is_global INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('processing', 'ready', 'error')),
  error_message TEXT,
  uploaded_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_is_global ON documents(is_global);

-- Document to category mapping
CREATE TABLE IF NOT EXISTS document_categories (
  document_id INTEGER NOT NULL,
  category_id INTEGER,
  PRIMARY KEY (document_id, category_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_document_categories_doc ON document_categories(document_id);
CREATE INDEX IF NOT EXISTS idx_document_categories_cat ON document_categories(category_id);

-- Threads
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_threads_user ON threads(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_updated ON threads(updated_at DESC);

-- Thread category selection
CREATE TABLE IF NOT EXISTS thread_categories (
  thread_id TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (thread_id, category_id),
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_thread_categories_thread ON thread_categories(thread_id);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  sources_json TEXT,
  attachments_json TEXT,
  tool_calls_json TEXT,
  tool_call_id TEXT,
  tool_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Thread file uploads
CREATE TABLE IF NOT EXISTS thread_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_thread_uploads_thread ON thread_uploads(thread_id);

-- AI-generated files
CREATE TABLE IF NOT EXISTS thread_outputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  message_id TEXT,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'pdf', 'docx', 'xlsx', 'pptx')),
  file_size INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_thread_outputs_thread ON thread_outputs(thread_id);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

-- Storage alerts
CREATE TABLE IF NOT EXISTS storage_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  threshold_percent INTEGER NOT NULL,
  current_percent INTEGER NOT NULL,
  alerted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at DATETIME,
  acknowledged_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_storage_alerts_pending ON storage_alerts(acknowledged_at) WHERE acknowledged_at IS NULL;
  `;
}

/**
 * Initialize default settings if not present
 */
function initializeDefaultSettings(database: Database.Database): void {
  const defaults: Record<string, object> = {
    'rag-settings': {
      topKChunks: 20,
      maxContextChunks: 15,
      similarityThreshold: 0.5,
      chunkSize: 800,
      chunkOverlap: 150,
      queryExpansionEnabled: true,
      cacheEnabled: true,
      cacheTTLSeconds: 3600,
    },
    'llm-settings': {
      model: 'gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 2000,
    },
    'tavily-settings': {
      enabled: false,
      defaultTopic: 'general',
      defaultSearchDepth: 'basic',
      maxResults: 5,
      includeDomains: [],
      excludeDomains: [],
      cacheTTLSeconds: 3600,
    },
    'upload-limits': {
      maxFilesPerThread: 5,
      maxFileSizeMB: 10,
      allowedTypes: ['application/pdf'],
    },
    'acronym-mappings': {},
    'system-prompt': {
      content: getDefaultSystemPrompt(),
    },
    'retention-settings': {
      threadRetentionDays: 90,
      storageAlertThreshold: 70,
    },
  };

  const insertStmt = database.prepare(`
    INSERT OR IGNORE INTO settings (key, value, updated_by)
    VALUES (?, ?, 'system')
  `);

  for (const [key, value] of Object.entries(defaults)) {
    insertStmt.run(key, JSON.stringify(value));
  }
}

/**
 * Default system prompt
 */
function getDefaultSystemPrompt(): string {
  return `You are a helpful assistant that answers questions based on the provided knowledge base documents.

Guidelines:
- Only answer questions using information from the provided context
- If the information is not in the context, say so clearly
- Always cite your sources with document names and page numbers
- Use markdown formatting for better readability
- Be concise but thorough`;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Run a query and return all results
 */
export function queryAll<T>(sql: string, params: unknown[] = []): T[] {
  const database = getDatabase();
  return database.prepare(sql).all(...params) as T[];
}

/**
 * Run a query and return the first result
 */
export function queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
  const database = getDatabase();
  return database.prepare(sql).get(...params) as T | undefined;
}

/**
 * Run an insert/update/delete and return the result
 */
export function execute(sql: string, params: unknown[] = []): Database.RunResult {
  const database = getDatabase();
  return database.prepare(sql).run(...params);
}

/**
 * Run multiple statements in a transaction
 */
export function transaction<T>(fn: () => T): T {
  const database = getDatabase();
  return database.transaction(fn)();
}

/**
 * Export database instance type for use in other modules
 */
export type { Database };
