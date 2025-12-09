-- Policy Bot Database Schema
-- SQLite database for users, categories, threads, messages, documents, and settings

-- ============ Users & Roles ============

-- Primary user table
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

-- ============ Categories ============

-- Document categories (each maps to a ChromaDB collection)
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- Super user category assignments (many-to-many)
CREATE TABLE IF NOT EXISTS super_user_categories (
  user_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  assigned_by TEXT NOT NULL,
  PRIMARY KEY (user_id, category_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- User category subscriptions (many-to-many)
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

-- Category-specific prompt addendum (appended to global system prompt)
CREATE TABLE IF NOT EXISTS category_prompts (
  category_id INTEGER PRIMARY KEY,
  prompt_addendum TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- ============ Documents ============

-- Document metadata
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

-- Document to category mapping (many-to-many)
CREATE TABLE IF NOT EXISTS document_categories (
  document_id INTEGER NOT NULL,
  category_id INTEGER,
  PRIMARY KEY (document_id, category_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_document_categories_doc ON document_categories(document_id);
CREATE INDEX IF NOT EXISTS idx_document_categories_cat ON document_categories(category_id);

-- ============ Threads & Messages ============

-- Conversation threads
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

-- Thread category selection (many-to-many)
CREATE TABLE IF NOT EXISTS thread_categories (
  thread_id TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (thread_id, category_id),
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_thread_categories_thread ON thread_categories(thread_id);

-- Conversation messages
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

-- Thread file uploads (user-uploaded PDFs)
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

-- ============ Memory & Summarization ============

-- User memory storage (facts per user+category)
CREATE TABLE IF NOT EXISTS user_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category_id INTEGER, -- NULL = global memory
  facts_json TEXT NOT NULL, -- JSON array of fact strings
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
  messages_summarized INTEGER NOT NULL, -- count of messages included
  tokens_before INTEGER, -- estimated tokens before summarization
  tokens_after INTEGER, -- tokens in summary
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

-- ============ Settings ============

-- Key-value settings store (replaces JSON config files)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

-- ============ Storage Monitoring ============

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

-- ============ Triggers ============

-- Update user updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_user_timestamp
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update thread updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_thread_timestamp
AFTER UPDATE ON threads
BEGIN
  UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update thread timestamp when message is added
CREATE TRIGGER IF NOT EXISTS update_thread_on_message
AFTER INSERT ON messages
BEGIN
  UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.thread_id;
END;
