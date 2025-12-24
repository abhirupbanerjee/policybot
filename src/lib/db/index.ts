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
import { validateLiteLLMOnStartup } from '../litellm-validator';
import { seedCoreSkills } from '../skills/seed';

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

  // Seed core skills (idempotent)
  seedCoreSkills();

  // Validate LiteLLM config (fail fast if default model missing)
  validateLiteLLMOnStartup();

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

  // Run migrations for new columns on existing tables
  runMigrations(database);
}

/**
 * Run migrations for adding new columns to existing tables
 */
function runMigrations(database: Database.Database): void {
  // Check and add is_summarized column to threads
  const threadsColumns = database.pragma('table_info(threads)') as { name: string }[];
  const threadColumnNames = threadsColumns.map((c) => c.name);

  if (!threadColumnNames.includes('is_summarized')) {
    database.exec('ALTER TABLE threads ADD COLUMN is_summarized INTEGER DEFAULT 0');
  }

  if (!threadColumnNames.includes('total_tokens')) {
    database.exec('ALTER TABLE threads ADD COLUMN total_tokens INTEGER DEFAULT 0');
  }

  // Check and add token_count column to messages
  const messagesColumns = database.pragma('table_info(messages)') as { name: string }[];
  const messageColumnNames = messagesColumns.map((c) => c.name);

  if (!messageColumnNames.includes('token_count')) {
    database.exec('ALTER TABLE messages ADD COLUMN token_count INTEGER');
  }

  // Check and add generated_documents_json column to messages (for autonomous doc_gen tool)
  if (!messageColumnNames.includes('generated_documents_json')) {
    database.exec('ALTER TABLE messages ADD COLUMN generated_documents_json TEXT');
  }

  // Check and add visualizations_json column to messages (for data_source tool charts)
  if (!messageColumnNames.includes('visualizations_json')) {
    database.exec('ALTER TABLE messages ADD COLUMN visualizations_json TEXT');
  }

  // Check if skills table exists, create if not (for existing databases)
  const skillsTableExists = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='skills'"
  ).get();

  // Check and add starter_prompts column to category_prompts
  const categoryPromptsColumns = database.pragma('table_info(category_prompts)') as { name: string }[];
  const categoryPromptsColumnNames = categoryPromptsColumns.map((c) => c.name);

  if (!categoryPromptsColumnNames.includes('starter_prompts')) {
    database.exec('ALTER TABLE category_prompts ADD COLUMN starter_prompts TEXT DEFAULT NULL');
  }

  if (!skillsTableExists) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        prompt_content TEXT NOT NULL,
        trigger_type TEXT NOT NULL CHECK (trigger_type IN ('always', 'category', 'keyword')),
        trigger_value TEXT,
        category_restricted INTEGER DEFAULT 0,
        is_index INTEGER DEFAULT 0,
        priority INTEGER DEFAULT 100,
        is_active INTEGER DEFAULT 1,
        is_core INTEGER DEFAULT 0,
        created_by_role TEXT NOT NULL CHECK (created_by_role IN ('admin', 'superuser')),
        token_estimate INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_skills_trigger ON skills(trigger_type, is_active);
      CREATE INDEX IF NOT EXISTS idx_skills_priority ON skills(priority);
      CREATE INDEX IF NOT EXISTS idx_skills_core ON skills(is_core);

      CREATE TABLE IF NOT EXISTS category_skills (
        category_id INTEGER NOT NULL,
        skill_id INTEGER NOT NULL,
        PRIMARY KEY (category_id, skill_id),
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_category_skills_category ON category_skills(category_id);
      CREATE INDEX IF NOT EXISTS idx_category_skills_skill ON category_skills(skill_id);
    `);
  }

  // Check and create tool_configs table for Tools system
  const toolConfigsTableExists = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='tool_configs'"
  ).get();

  if (!toolConfigsTableExists) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS tool_configs (
        id TEXT PRIMARY KEY,
        tool_name TEXT UNIQUE NOT NULL,
        is_enabled INTEGER DEFAULT 0,
        config_json TEXT NOT NULL,
        description_override TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tool_config_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
        old_config TEXT,
        new_config TEXT,
        changed_by TEXT NOT NULL,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tool_config_audit_name ON tool_config_audit(tool_name);
      CREATE INDEX IF NOT EXISTS idx_tool_config_audit_time ON tool_config_audit(changed_at DESC);
    `);
  }

  // Check and create category_tool_configs table for per-category tool settings
  const categoryToolConfigsTableExists = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='category_tool_configs'"
  ).get();

  if (!categoryToolConfigsTableExists) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS category_tool_configs (
        id TEXT PRIMARY KEY,
        category_id INTEGER NOT NULL,
        tool_name TEXT NOT NULL,
        is_enabled INTEGER,
        branding_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT NOT NULL,
        UNIQUE(category_id, tool_name),
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_category_tool_configs_category ON category_tool_configs(category_id);
      CREATE INDEX IF NOT EXISTS idx_category_tool_configs_tool ON category_tool_configs(tool_name);
    `);
  }

  // Check and add document generation columns to thread_outputs
  const threadOutputsColumns = database.pragma('table_info(thread_outputs)') as { name: string }[];
  const threadOutputsColumnNames = threadOutputsColumns.map((c) => c.name);

  if (!threadOutputsColumnNames.includes('generation_config')) {
    database.exec('ALTER TABLE thread_outputs ADD COLUMN generation_config TEXT');
  }

  if (!threadOutputsColumnNames.includes('expires_at')) {
    database.exec('ALTER TABLE thread_outputs ADD COLUMN expires_at DATETIME');
  }

  if (!threadOutputsColumnNames.includes('download_count')) {
    database.exec('ALTER TABLE thread_outputs ADD COLUMN download_count INTEGER DEFAULT 0');
  }

  // Check and create data_api_configs table for Data Sources feature
  const dataApiConfigsTableExists = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='data_api_configs'"
  ).get();

  if (!dataApiConfigsTableExists) {
    database.exec(`
      -- Data API configurations
      CREATE TABLE IF NOT EXISTS data_api_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT 'GET' CHECK(method IN ('GET', 'POST')),
        response_format TEXT DEFAULT 'json' CHECK(response_format IN ('json', 'csv')),
        authentication TEXT,
        headers TEXT,
        parameters TEXT,
        response_structure TEXT,
        sample_response TEXT,
        openapi_spec TEXT,
        config_method TEXT DEFAULT 'manual' CHECK(config_method IN ('manual', 'openapi')),
        status TEXT DEFAULT 'untested' CHECK(status IN ('active', 'inactive', 'error', 'untested')),
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_tested DATETIME,
        last_error TEXT
      );

      -- API-Category mapping (orphan APIs not accessible)
      CREATE TABLE IF NOT EXISTS data_api_categories (
        api_id TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (api_id) REFERENCES data_api_configs(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        PRIMARY KEY (api_id, category_id)
      );

      -- CSV data sources
      CREATE TABLE IF NOT EXISTS data_csv_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        file_path TEXT NOT NULL,
        original_filename TEXT,
        columns TEXT,
        sample_data TEXT,
        row_count INTEGER DEFAULT 0,
        file_size INTEGER DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- CSV-Category mapping (orphan CSVs not accessible)
      CREATE TABLE IF NOT EXISTS data_csv_categories (
        csv_id TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (csv_id) REFERENCES data_csv_configs(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        PRIMARY KEY (csv_id, category_id)
      );

      -- Audit log for data source changes
      CREATE TABLE IF NOT EXISTS data_source_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL CHECK(source_type IN ('api', 'csv')),
        source_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('created', 'updated', 'tested', 'deleted')),
        changed_by TEXT NOT NULL,
        details TEXT,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for data sources
      CREATE INDEX IF NOT EXISTS idx_data_api_status ON data_api_configs(status);
      CREATE INDEX IF NOT EXISTS idx_data_api_name ON data_api_configs(name);
      CREATE INDEX IF NOT EXISTS idx_data_api_categories_api ON data_api_categories(api_id);
      CREATE INDEX IF NOT EXISTS idx_data_api_categories_cat ON data_api_categories(category_id);
      CREATE INDEX IF NOT EXISTS idx_data_csv_name ON data_csv_configs(name);
      CREATE INDEX IF NOT EXISTS idx_data_csv_categories_csv ON data_csv_categories(csv_id);
      CREATE INDEX IF NOT EXISTS idx_data_csv_categories_cat ON data_csv_categories(category_id);
      CREATE INDEX IF NOT EXISTS idx_data_source_audit_source ON data_source_audit(source_type, source_id);
      CREATE INDEX IF NOT EXISTS idx_data_source_audit_time ON data_source_audit(changed_at DESC);
    `);
  }

  // Check and create function_api_configs table for Function Calling APIs
  const functionApiConfigsTableExists = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='function_api_configs'"
  ).get();

  if (!functionApiConfigsTableExists) {
    database.exec(`
      -- Function API configurations (OpenAI-format function calling)
      CREATE TABLE IF NOT EXISTS function_api_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        base_url TEXT NOT NULL,
        auth_type TEXT NOT NULL DEFAULT 'api_key' CHECK(auth_type IN ('api_key', 'bearer', 'basic', 'none')),
        auth_header TEXT,
        auth_credentials TEXT,
        default_headers TEXT,
        tools_schema TEXT NOT NULL,
        endpoint_mappings TEXT NOT NULL,
        timeout_seconds INTEGER DEFAULT 30,
        cache_ttl_seconds INTEGER DEFAULT 3600,
        is_enabled INTEGER DEFAULT 1,
        status TEXT DEFAULT 'untested' CHECK(status IN ('active', 'inactive', 'error', 'untested')),
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_tested DATETIME,
        last_error TEXT
      );

      -- Function API-Category mapping
      CREATE TABLE IF NOT EXISTS function_api_categories (
        api_id TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (api_id) REFERENCES function_api_configs(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        PRIMARY KEY (api_id, category_id)
      );

      -- Indexes for function APIs
      CREATE INDEX IF NOT EXISTS idx_function_api_status ON function_api_configs(status);
      CREATE INDEX IF NOT EXISTS idx_function_api_name ON function_api_configs(name);
      CREATE INDEX IF NOT EXISTS idx_function_api_enabled ON function_api_configs(is_enabled);
      CREATE INDEX IF NOT EXISTS idx_function_api_categories_api ON function_api_categories(api_id);
      CREATE INDEX IF NOT EXISTS idx_function_api_categories_cat ON function_api_categories(category_id);
    `);
  }

  // Check and add config_json column to category_tool_configs
  const ctcColumns = database.pragma('table_info(category_tool_configs)') as { name: string }[];
  const ctcColumnNames = ctcColumns.map((c) => c.name);

  if (!ctcColumnNames.includes('config_json')) {
    database.exec('ALTER TABLE category_tool_configs ADD COLUMN config_json TEXT');
  }

  // Check and add description_override column to tool_configs (for admin-editable tool descriptions)
  const toolConfigsColumns = database.pragma('table_info(tool_configs)') as { name: string }[];
  const toolConfigsColumnNames = toolConfigsColumns.map((c) => c.name);

  if (!toolConfigsColumnNames.includes('description_override')) {
    database.exec('ALTER TABLE tool_configs ADD COLUMN description_override TEXT');
  }

  // Check and create tool_routing_rules table for keyword-based tool routing
  const toolRoutingRulesTableExists = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='tool_routing_rules'"
  ).get();

  if (!toolRoutingRulesTableExists) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS tool_routing_rules (
        id TEXT PRIMARY KEY,
        tool_name TEXT NOT NULL,
        rule_name TEXT NOT NULL,
        rule_type TEXT NOT NULL CHECK (rule_type IN ('keyword', 'regex')),
        patterns TEXT NOT NULL,
        force_mode TEXT NOT NULL DEFAULT 'required'
          CHECK (force_mode IN ('required', 'preferred', 'suggested')),
        priority INTEGER DEFAULT 100,
        category_ids TEXT DEFAULT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tool_routing_rules_tool ON tool_routing_rules(tool_name);
      CREATE INDEX IF NOT EXISTS idx_tool_routing_rules_active ON tool_routing_rules(is_active);
      CREATE INDEX IF NOT EXISTS idx_tool_routing_rules_priority ON tool_routing_rules(priority);
    `);
  }

  // Check and create task_plans table for Task Planner tool
  const taskPlansTableExists = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='task_plans'"
  ).get();

  if (!taskPlansTableExists) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS task_plans (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        category_slug TEXT,
        title TEXT,
        tasks_json TEXT NOT NULL,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'failed')),
        total_tasks INTEGER DEFAULT 0,
        completed_tasks INTEGER DEFAULT 0,
        failed_tasks INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_task_plans_thread ON task_plans(thread_id);
      CREATE INDEX IF NOT EXISTS idx_task_plans_status ON task_plans(status);
      CREATE INDEX IF NOT EXISTS idx_task_plans_user ON task_plans(user_id);
    `);
  }

  // Migration: Update file_type CHECK constraint to include 'md' format
  // SQLite doesn't allow modifying CHECK constraints, so we recreate the table
  try {
    // Test if 'md' is allowed by the current constraint
    database.exec(`
      INSERT INTO thread_outputs (thread_id, filename, filepath, file_type, file_size)
      VALUES ('__migration_test__', '__test__', '__test__', 'md', 0)
    `);
    // If successful, delete the test row
    database.exec(`DELETE FROM thread_outputs WHERE thread_id = '__migration_test__'`);
  } catch {
    // 'md' is not allowed, need to recreate the table with updated constraint
    database.exec(`
      -- Create new table with updated constraint
      CREATE TABLE thread_outputs_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id TEXT NOT NULL,
        message_id TEXT,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        file_type TEXT NOT NULL CHECK (file_type IN ('image', 'pdf', 'docx', 'xlsx', 'pptx', 'md')),
        file_size INTEGER NOT NULL,
        generation_config TEXT,
        expires_at DATETIME,
        download_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
      );

      -- Copy existing data
      INSERT INTO thread_outputs_new (id, thread_id, message_id, filename, filepath, file_type, file_size, generation_config, expires_at, download_count, created_at)
      SELECT id, thread_id, message_id, filename, filepath, file_type, file_size, generation_config, expires_at, download_count, created_at
      FROM thread_outputs;

      -- Drop old table and rename new one
      DROP TABLE thread_outputs;
      ALTER TABLE thread_outputs_new RENAME TO thread_outputs;

      -- Recreate indexes
      CREATE INDEX IF NOT EXISTS idx_thread_outputs_thread ON thread_outputs(thread_id);
      CREATE INDEX IF NOT EXISTS idx_thread_outputs_expires ON thread_outputs(expires_at);
    `);
  }
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
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'pdf', 'docx', 'xlsx', 'pptx', 'md')),
  file_size INTEGER NOT NULL,
  generation_config TEXT,
  expires_at DATETIME,
  download_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_thread_outputs_thread ON thread_outputs(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_outputs_expires ON thread_outputs(expires_at);

-- User memory storage (facts per user+category)
CREATE TABLE IF NOT EXISTS user_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category_id INTEGER,
  facts_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, category_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_memories_user ON user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_category ON user_memories(category_id);

-- Thread summaries
CREATE TABLE IF NOT EXISTS thread_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  messages_summarized INTEGER NOT NULL,
  tokens_before INTEGER,
  tokens_after INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_thread_summaries_thread ON thread_summaries(thread_id);

-- Archived messages (original messages after summarization)
CREATE TABLE IF NOT EXISTS archived_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  sources_json TEXT,
  created_at DATETIME NOT NULL,
  archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  summary_id INTEGER,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
  FOREIGN KEY (summary_id) REFERENCES thread_summaries(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_archived_messages_thread ON archived_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_archived_messages_summary ON archived_messages(summary_id);

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

-- Tool configurations (Tools system)
CREATE TABLE IF NOT EXISTS tool_configs (
  id TEXT PRIMARY KEY,
  tool_name TEXT UNIQUE NOT NULL,
  is_enabled INTEGER DEFAULT 0,
  config_json TEXT NOT NULL,
  description_override TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL
);

-- Tool configuration audit trail
CREATE TABLE IF NOT EXISTS tool_config_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  old_config TEXT,
  new_config TEXT,
  changed_by TEXT NOT NULL,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tool_config_audit_name ON tool_config_audit(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_config_audit_time ON tool_config_audit(changed_at DESC);

-- Category-level tool configurations (superuser overrides)
CREATE TABLE IF NOT EXISTS category_tool_configs (
  id TEXT PRIMARY KEY,
  category_id INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  is_enabled INTEGER,
  branding_json TEXT,
  config_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL,
  UNIQUE(category_id, tool_name),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_category_tool_configs_category ON category_tool_configs(category_id);
CREATE INDEX IF NOT EXISTS idx_category_tool_configs_tool ON category_tool_configs(tool_name);

-- Task plans for Task Planner tool
CREATE TABLE IF NOT EXISTS task_plans (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  category_slug TEXT,
  title TEXT,
  tasks_json TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'failed')),
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_task_plans_thread ON task_plans(thread_id);
CREATE INDEX IF NOT EXISTS idx_task_plans_status ON task_plans(status);
CREATE INDEX IF NOT EXISTS idx_task_plans_user ON task_plans(user_id);

-- Data API configurations
CREATE TABLE IF NOT EXISTS data_api_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET' CHECK(method IN ('GET', 'POST')),
  response_format TEXT DEFAULT 'json' CHECK(response_format IN ('json', 'csv')),
  authentication TEXT,
  headers TEXT,
  parameters TEXT,
  response_structure TEXT,
  sample_response TEXT,
  openapi_spec TEXT,
  config_method TEXT DEFAULT 'manual' CHECK(config_method IN ('manual', 'openapi')),
  status TEXT DEFAULT 'untested' CHECK(status IN ('active', 'inactive', 'error', 'untested')),
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_tested DATETIME,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_data_api_status ON data_api_configs(status);
CREATE INDEX IF NOT EXISTS idx_data_api_name ON data_api_configs(name);

-- API-Category mapping
CREATE TABLE IF NOT EXISTS data_api_categories (
  api_id TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_id) REFERENCES data_api_configs(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (api_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_data_api_categories_api ON data_api_categories(api_id);
CREATE INDEX IF NOT EXISTS idx_data_api_categories_cat ON data_api_categories(category_id);

-- CSV data sources
CREATE TABLE IF NOT EXISTS data_csv_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  file_path TEXT NOT NULL,
  original_filename TEXT,
  columns TEXT,
  sample_data TEXT,
  row_count INTEGER DEFAULT 0,
  file_size INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_data_csv_name ON data_csv_configs(name);

-- CSV-Category mapping
CREATE TABLE IF NOT EXISTS data_csv_categories (
  csv_id TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (csv_id) REFERENCES data_csv_configs(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (csv_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_data_csv_categories_csv ON data_csv_categories(csv_id);
CREATE INDEX IF NOT EXISTS idx_data_csv_categories_cat ON data_csv_categories(category_id);

-- Data source audit log
CREATE TABLE IF NOT EXISTS data_source_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL CHECK(source_type IN ('api', 'csv')),
  source_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('created', 'updated', 'tested', 'deleted')),
  changed_by TEXT NOT NULL,
  details TEXT,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_data_source_audit_source ON data_source_audit(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_data_source_audit_time ON data_source_audit(changed_at DESC);

-- Function API configurations (OpenAI-format function calling)
CREATE TABLE IF NOT EXISTS function_api_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  base_url TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'api_key' CHECK(auth_type IN ('api_key', 'bearer', 'basic', 'none')),
  auth_header TEXT,
  auth_credentials TEXT,
  default_headers TEXT,
  tools_schema TEXT NOT NULL,
  endpoint_mappings TEXT NOT NULL,
  timeout_seconds INTEGER DEFAULT 30,
  cache_ttl_seconds INTEGER DEFAULT 3600,
  is_enabled INTEGER DEFAULT 1,
  status TEXT DEFAULT 'untested' CHECK(status IN ('active', 'inactive', 'error', 'untested')),
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_tested DATETIME,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_function_api_status ON function_api_configs(status);
CREATE INDEX IF NOT EXISTS idx_function_api_name ON function_api_configs(name);
CREATE INDEX IF NOT EXISTS idx_function_api_enabled ON function_api_configs(is_enabled);

-- Function API-Category mapping
CREATE TABLE IF NOT EXISTS function_api_categories (
  api_id TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_id) REFERENCES function_api_configs(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (api_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_function_api_categories_api ON function_api_categories(api_id);
CREATE INDEX IF NOT EXISTS idx_function_api_categories_cat ON function_api_categories(category_id);
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
    'memory-settings': {
      enabled: false,
      extractionThreshold: 5,
      maxFactsPerCategory: 20,
      autoExtractOnThreadEnd: true,
    },
    'summarization-settings': {
      enabled: false,
      tokenThreshold: 100000,
      keepRecentMessages: 10,
      summaryMaxTokens: 2000,
      archiveOriginalMessages: true,
    },
    'skills-settings': {
      enabled: false,
      maxTotalTokens: 3000,
      debugMode: false,
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
