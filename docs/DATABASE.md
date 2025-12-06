# Policy Bot - Database & Storage Architecture

## Overview

Policy Bot uses a hybrid storage approach:
- **SQLite**: Structured metadata (users, categories, documents, threads, messages, settings)
- **ChromaDB**: Vector embeddings for semantic search (per-category collections)
- **Redis**: Caching (RAG responses, Tavily results) and session management
- **Filesystem**: PDF files (global-docs, thread uploads)

---

## 1. SQLite Database Schema

The SQLite database (`data/policy-bot.db`) stores all structured metadata with ACID transactions and efficient queries.

### Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     users       │     │   categories    │     │   documents     │
│─────────────────│     │─────────────────│     │─────────────────│
│ id (PK)         │     │ id (PK)         │     │ id (PK)         │
│ email           │     │ name            │     │ filename        │
│ name            │     │ slug            │     │ filepath        │
│ role            │     │ description     │     │ file_size       │
│ added_by        │     │ created_by      │     │ is_global       │
│ created_at      │     │ created_at      │     │ chunk_count     │
│ updated_at      │     └────────┬────────┘     │ status          │
└────────┬────────┘              │              │ error_message   │
         │                       │              │ uploaded_by     │
         │    ┌──────────────────┼──────────────┤ created_at      │
         │    │                  │              └────────┬────────┘
         ▼    ▼                  ▼                       │
┌─────────────────┐     ┌─────────────────┐     ┌────────▼────────┐
│super_user_cats  │     │user_subscriptions│    │document_categories│
│─────────────────│     │─────────────────│     │─────────────────│
│ user_id (FK)    │     │ user_id (FK)    │     │ document_id (FK)│
│ category_id(FK) │     │ category_id(FK) │     │ category_id(FK) │
│ assigned_at     │     │ is_active       │     └─────────────────┘
│ assigned_by     │     │ subscribed_at   │
└─────────────────┘     │ subscribed_by   │
                        └─────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    threads      │     │   messages      │     │ thread_uploads  │
│─────────────────│     │─────────────────│     │─────────────────│
│ id (PK)         │◄────│ thread_id (FK)  │     │ id (PK)         │
│ user_id (FK)    │     │ id (PK)         │     │ thread_id (FK)  │
│ title           │     │ role            │     │ filename        │
│ created_at      │     │ content         │     │ filepath        │
│ updated_at      │     │ sources_json    │     │ file_size       │
└────────┬────────┘     │ attachments_json│     │ uploaded_at     │
         │              │ tool_calls_json │     └─────────────────┘
         │              │ tool_call_id    │
         ▼              │ tool_name       │     ┌─────────────────┐
┌─────────────────┐     │ created_at      │     │    settings     │
│thread_categories│     └─────────────────┘     │─────────────────│
│─────────────────│                             │ key (PK)        │
│ thread_id (FK)  │     ┌─────────────────┐     │ value           │
│ category_id(FK) │     │ thread_outputs  │     │ updated_at      │
└─────────────────┘     │─────────────────│     │ updated_by      │
                        │ id (PK)         │     └─────────────────┘
                        │ thread_id (FK)  │
                        │ message_id (FK) │     ┌─────────────────┐
                        │ filename        │     │ storage_alerts  │
                        │ filepath        │     │─────────────────│
                        │ file_type       │     │ id (PK)         │
                        │ file_size       │     │ threshold_%     │
                        │ created_at      │     │ current_%       │
                        └─────────────────┘     │ alerted_at      │
                                                │ acknowledged_at │
                                                │ acknowledged_by │
                                                └─────────────────┘
```

### Complete Schema Definition

```sql
-- ============ Users & Roles ============

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

-- ============ Documents ============

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

-- ============ Settings ============

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

-- ============ Storage Monitoring ============

CREATE TABLE IF NOT EXISTS storage_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  threshold_percent INTEGER NOT NULL,
  current_percent INTEGER NOT NULL,
  alerted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at DATETIME,
  acknowledged_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_storage_alerts_pending
ON storage_alerts(acknowledged_at) WHERE acknowledged_at IS NULL;

-- ============ Triggers ============

CREATE TRIGGER IF NOT EXISTS update_user_timestamp
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_thread_timestamp
AFTER UPDATE ON threads
BEGIN
  UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_thread_on_message
AFTER INSERT ON messages
BEGIN
  UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.thread_id;
END;
```

---

## 2. Table Descriptions

### users

Primary user table with role-based access control.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment primary key |
| email | TEXT | Unique email (case-insensitive lookup) |
| name | TEXT | Optional display name |
| role | TEXT | `admin`, `superuser`, or `user` |
| added_by | TEXT | Email of admin who added (or 'system') |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### categories

Document categories, each mapping to a ChromaDB collection.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment primary key |
| name | TEXT | Unique category name (e.g., "HR", "Finance") |
| slug | TEXT | URL-safe slug (e.g., "hr", "finance") |
| description | TEXT | Optional description |
| created_by | TEXT | Admin email who created |
| created_at | DATETIME | Creation timestamp |

### super_user_categories

Maps super users to categories they can manage.

| Column | Type | Description |
|--------|------|-------------|
| user_id | INTEGER | FK to users.id |
| category_id | INTEGER | FK to categories.id |
| assigned_at | DATETIME | When assigned |
| assigned_by | TEXT | Admin email who assigned |

### user_subscriptions

Maps regular users to categories they can query.

| Column | Type | Description |
|--------|------|-------------|
| user_id | INTEGER | FK to users.id |
| category_id | INTEGER | FK to categories.id |
| is_active | INTEGER | 1=active, 0=paused |
| subscribed_at | DATETIME | When subscribed |
| subscribed_by | TEXT | Admin/superuser email who subscribed |

### documents

Metadata for global policy documents.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment primary key |
| filename | TEXT | Original filename |
| filepath | TEXT | Path relative to global-docs/ |
| file_size | INTEGER | File size in bytes |
| is_global | INTEGER | 1=indexed in all categories |
| chunk_count | INTEGER | Number of chunks in ChromaDB |
| status | TEXT | `processing`, `ready`, or `error` |
| error_message | TEXT | Error details if status='error' |
| uploaded_by | TEXT | Admin email who uploaded |
| created_at | DATETIME | Upload timestamp |

### document_categories

Maps documents to categories (many-to-many).

| Column | Type | Description |
|--------|------|-------------|
| document_id | INTEGER | FK to documents.id |
| category_id | INTEGER | FK to categories.id (NULL if category deleted) |

### threads

Conversation threads belonging to users.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID v4 primary key |
| user_id | INTEGER | FK to users.id |
| title | TEXT | Auto-generated from first message |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last activity timestamp |

### thread_categories

Categories selected for a thread (for RAG queries).

| Column | Type | Description |
|--------|------|-------------|
| thread_id | TEXT | FK to threads.id |
| category_id | INTEGER | FK to categories.id |

### messages

Conversation messages within threads.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID v4 primary key |
| thread_id | TEXT | FK to threads.id |
| role | TEXT | `user`, `assistant`, or `tool` |
| content | TEXT | Message text (markdown supported) |
| sources_json | TEXT | JSON array of Source objects |
| attachments_json | TEXT | JSON array of attachment filenames |
| tool_calls_json | TEXT | JSON array of tool calls (OpenAI format) |
| tool_call_id | TEXT | Tool call ID (for tool responses) |
| tool_name | TEXT | Tool name (for tool responses) |
| created_at | DATETIME | Message timestamp |

### thread_uploads

User-uploaded PDFs attached to threads.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment primary key |
| thread_id | TEXT | FK to threads.id |
| filename | TEXT | Original filename |
| filepath | TEXT | Path to stored file |
| file_size | INTEGER | File size in bytes |
| uploaded_at | DATETIME | Upload timestamp |

### thread_outputs

AI-generated files (images, documents).

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment primary key |
| thread_id | TEXT | FK to threads.id |
| message_id | TEXT | FK to messages.id (nullable) |
| filename | TEXT | Generated filename |
| filepath | TEXT | Path to stored file |
| file_type | TEXT | `image`, `pdf`, `docx`, `xlsx`, `pptx` |
| file_size | INTEGER | File size in bytes |
| created_at | DATETIME | Creation timestamp |

### settings

Key-value configuration store.

| Column | Type | Description |
|--------|------|-------------|
| key | TEXT | Setting key (primary key) |
| value | TEXT | JSON-encoded value |
| updated_at | DATETIME | Last update timestamp |
| updated_by | TEXT | Admin email who updated |

**Settings Keys:**

| Key | Type | Description |
|-----|------|-------------|
| `rag-settings` | RagSettings | RAG retrieval parameters |
| `llm-settings` | LlmSettings | LLM model and parameters |
| `tavily-settings` | TavilySettings | Web search configuration |
| `upload-limits` | UploadLimits | File upload constraints |
| `system-prompt` | SystemPrompt | AI system prompt content |
| `acronym-mappings` | AcronymMappings | Custom acronym expansions |
| `retention-settings` | RetentionSettings | Data retention policies |
| `branding-settings` | BrandingSettings | Bot name and icon for sidebar |

**BrandingSettings Interface:**

```typescript
export interface BrandingSettings {
  botName: string;    // Display name in sidebar (default: "Policy Bot")
  botIcon: string;    // Icon key: government, operations, finance, kpi, logs, data, monitoring, architecture, internet, systems, policy
}
```

### storage_alerts

Storage usage alerts for monitoring.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment primary key |
| threshold_percent | INTEGER | Threshold that was crossed |
| current_percent | INTEGER | Current usage percentage |
| alerted_at | DATETIME | Alert timestamp |
| acknowledged_at | DATETIME | When acknowledged (NULL if pending) |
| acknowledged_by | TEXT | Admin who acknowledged |

---

## 3. TypeScript Interfaces

### Database Layer Types

```typescript
// src/lib/db/users.ts

export type UserRole = 'admin' | 'superuser' | 'user';

export interface DbUser {
  id: number;
  email: string;
  name: string | null;
  role: UserRole;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWithSubscriptions extends DbUser {
  subscriptions: {
    categoryId: number;
    categoryName: string;
    categorySlug: string;
    isActive: boolean;
  }[];
}

export interface UserWithAssignments extends DbUser {
  assignedCategories: {
    categoryId: number;
    categoryName: string;
    categorySlug: string;
  }[];
}

// src/lib/db/categories.ts

export interface DbCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface CategoryWithStats extends DbCategory {
  documentCount: number;
  superUserCount: number;
  subscriberCount: number;
}

// src/lib/db/documents.ts

export interface DbDocument {
  id: number;
  filename: string;
  filepath: string;
  file_size: number;
  is_global: number;
  chunk_count: number;
  status: 'processing' | 'ready' | 'error';
  error_message: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface DocumentWithCategories extends DbDocument {
  categories: {
    categoryId: number;
    categoryName: string;
  }[];
}

// src/lib/db/threads.ts

export interface DbThread {
  id: string;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  sources_json: string | null;
  attachments_json: string | null;
  tool_calls_json: string | null;
  tool_call_id: string | null;
  tool_name: string | null;
  created_at: string;
}
```

### API Response Types

```typescript
// src/types/index.ts

export interface Source {
  documentName: string;
  pageNumber: number;
  chunkText: string;
  score: number;
  isWeb?: boolean;  // True if from Tavily web search
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  attachments?: string[];
  timestamp: Date;
}

export interface Thread {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  uploadCount: number;
  categoryIds: number[];
}

export interface GlobalDocument {
  id: number;
  filename: string;
  filepath: string;
  size: number;
  chunkCount: number;
  uploadedAt: Date;
  uploadedBy: string;
  status: 'processing' | 'ready' | 'error';
  errorMessage?: string;
  isGlobal: boolean;
  categories: DocumentCategory[];
}

export interface DocumentCategory {
  categoryId: number;
  categoryName: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  documentCount: number;
  superUserCount: number;
  subscriberCount: number;
}

export interface AllowedUser {
  email: string;
  name?: string;
  role: 'admin' | 'superuser' | 'user';
  addedAt: Date;
  addedBy: string;
  subscriptions: { categoryId: number; categoryName: string; isActive: boolean }[];
  assignedCategories: { categoryId: number; categoryName: string }[];
}
```

---

## 4. ChromaDB Schema

### Category-Based Collections

Each category has its own ChromaDB collection with the naming pattern `policy_{category_slug}`:

```
ChromaDB Collections:
├── policy_hr           ← HR category documents
├── policy_finance      ← Finance category documents
├── policy_it           ← IT category documents
└── policy_legal        ← Legal category documents
```

**Global Documents**: When `is_global=1`, document chunks are indexed into ALL category collections.

### Collection Configuration

```typescript
{
  name: "policy_{slug}",
  metadata: {
    "hnsw:space": "cosine"  // Cosine similarity for text embeddings
  }
}
```

### Chunk Document Schema

```typescript
interface ChromaDocument {
  id: string;           // Format: "{docId}-chunk-{index}"
  embedding: number[];  // 3072 dimensions (text-embedding-3-large)
  document: string;     // The actual chunk text
  metadata: {
    documentId: number;      // Parent document ID (SQLite)
    documentName: string;    // Original filename
    pageNumber: number;      // Page where chunk appears
    chunkIndex: number;      // Position in document
    source: 'global' | 'user';  // Document source type
    threadId?: string;       // Only for user uploads
    userId?: number;         // Only for user uploads
  }
}
```

### Chunking Strategy

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Chunk Size | Configurable (default 500) | Balance between context and specificity |
| Overlap | Configurable (default 50) | Ensure continuity across chunks |
| Separators | `['\n\n', '\n', '. ', ' ', '']` | Preserve paragraph/sentence boundaries |

### Query Pattern

```typescript
// Query for relevant chunks from user's subscribed categories
const categoryCollections = getUserCategorySlugs(userId);

for (const slug of categoryCollections) {
  const collection = await chromaClient.getCollection(`policy_${slug}`);
  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: 5,
    include: ["documents", "metadatas", "distances"]
  });
}
```

---

## 5. Redis Schema

### Key Patterns

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `query:{hash}` | Configurable (1h default) | Cached RAG responses |
| `query:tavily:{hash}` | Configurable (1d default) | Cached web search results |
| `session:{token}` | 24 hours | User session data |

### Cache Management Commands

```bash
# 1. Flush complete Redis database (all cache)
docker exec policy-bot-redis redis-cli FLUSHALL

# 2. Flush RAG query cache only (excludes Tavily)
docker exec policy-bot-redis redis-cli --scan --pattern "query:*" --count 1000 | grep -v "tavily" | xargs -r docker exec -i policy-bot-redis redis-cli DEL

# 3. Flush Tavily web search cache only
docker exec policy-bot-redis redis-cli --scan --pattern "query:tavily:*" | xargs -r docker exec -i policy-bot-redis redis-cli DEL

# Verify cache entries
docker exec policy-bot-redis redis-cli KEYS "*"
```

> **Note:** The Admin Documents page "Refresh" button performs a complete Redis flush (`FLUSHALL`) plus reindexes all documents.

### Query Cache Schema

**Key**: `query:{md5(query + categories + settings)}`

```typescript
interface CachedQuery {
  answer: string;
  sources: Source[];
  cachedAt: string;  // ISO 8601 timestamp
}
```

### Tavily Cache Schema

**Key**: `tavily:{md5(searchQuery)}`

```typescript
interface CachedTavilyResult {
  results: TavilySearchResult[];
  cachedAt: string;
}
```

### Session Schema

Managed by NextAuth. Sessions stored in Redis for persistence.

**Key**: `session:{sessionToken}`

```typescript
interface Session {
  user: {
    name: string;
    email: string;
    image?: string;
    role: 'admin' | 'superuser' | 'user';
  };
  expires: string;
}
```

---

## 6. Filesystem Storage

### Directory Structure

```
data/
├── policy-bot.db           ← SQLite database
├── global-docs/            ← Admin-uploaded policy documents
│   ├── Leave_Policy.pdf
│   ├── Travel_Guidelines.pdf
│   └── HR_Handbook.pdf
└── threads/                ← User thread data
    └── {userId}/
        └── {threadId}/
            ├── uploads/    ← User-uploaded PDFs
            │   └── document.pdf
            └── outputs/    ← AI-generated files
                └── chart.png
```

### File Storage Notes

- **global-docs/**: Admin uploads stored here, metadata in SQLite `documents` table
- **threads/{userId}/{threadId}/uploads/**: User uploads, metadata in `thread_uploads` table
- **threads/{userId}/{threadId}/outputs/**: AI outputs, metadata in `thread_outputs` table
- PDF files are stored with sanitized filenames to prevent path traversal

---

## 7. Data Flow Diagrams

### User Creation with Subscriptions

```
Admin Creates User
    │
    ▼
┌─────────────────┐
│ Insert into     │
│ users table     │
│ (role, email)   │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ For each        │
│ category ID:    │
│ Insert into     │
│ user_subscriptions
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Return user     │
│ with subs list  │
└─────────────────┘
```

### Document Upload with Categories

```
Admin Upload
    │
    ▼
┌─────────────────┐
│ Validate PDF    │
│ (type, ≤50MB)   │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Save file to    │
│ global-docs/    │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Insert into     │
│ documents       │
│ (status=process)│
└─────────────────┘
    │
    ├── is_global=true ──▶ No document_categories entries
    │                      (indexed in ALL collections)
    │
    └── is_global=false ─▶ Insert document_categories
                           for each selected category
    │
    ▼
┌─────────────────┐
│ Extract text    │
│ (Mistral OCR)   │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Chunk + Embed   │
└─────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ Store in ChromaDB:              │
│ - Global: ALL policy_* colls   │
│ - Category: specific colls     │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────┐
│ Update document │
│ status=ready    │
│ chunk_count=N   │
└─────────────────┘
```

### Category-Aware Query Flow

```
User Query
    │
    ▼
┌─────────────────┐
│ Get user's      │
│ subscribed      │
│ category IDs    │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Get thread      │
│ category IDs    │
│ (if selected)   │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Intersect:      │
│ user subs ∩     │
│ thread cats     │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Query each      │
│ policy_{slug}   │
│ collection      │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Merge & rank    │
│ results         │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Generate answer │
│ with GPT        │
└─────────────────┘
```

---

## 8. Indexes and Performance

### SQLite Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| users | idx_users_email | Fast email lookups |
| users | idx_users_role | Filter by role |
| categories | idx_categories_slug | Collection name lookups |
| user_subscriptions | idx_user_subscriptions_user | Get user's subscriptions |
| user_subscriptions | idx_user_subscriptions_category | Get category subscribers |
| documents | idx_documents_status | Filter by processing status |
| documents | idx_documents_is_global | Find global documents |
| document_categories | idx_document_categories_doc | Get document's categories |
| document_categories | idx_document_categories_cat | Get category's documents |
| threads | idx_threads_user | Get user's threads |
| threads | idx_threads_updated | Sort by recent activity |
| messages | idx_messages_thread | Get thread's messages |
| storage_alerts | idx_storage_alerts_pending | Find unacknowledged alerts |

### ChromaDB Index

ChromaDB maintains HNSW (Hierarchical Navigable Small World) index for fast ANN search:

```typescript
{
  "hnsw:space": "cosine",
  "hnsw:construction_ef": 200,
  "hnsw:search_ef": 100
}
```

### Query Optimization Tips

1. Use `getUserWithSubscriptions()` for single query with JOINs
2. Batch embedding creation during ingestion (100 chunks/batch)
3. Enable Redis caching for frequently asked questions
4. Limit ChromaDB query results to top 5-10 per collection

---

## 9. Backup & Recovery

### SQLite Backup

```bash
# Backup database
sqlite3 data/policy-bot.db ".backup data/backup-$(date +%Y%m%d).db"

# Restore database
cp data/backup-20241202.db data/policy-bot.db
```

### ChromaDB Backup

```bash
# Backup ChromaDB volume
docker run --rm -v policy-bot_chroma_data:/data -v $(pwd):/backup \
  alpine tar czvf /backup/chroma-backup.tar.gz -C /data .

# Restore
docker run --rm -v policy-bot_chroma_data:/data -v $(pwd):/backup \
  alpine tar xzvf /backup/chroma-backup.tar.gz -C /data
```

### Redis Backup

```bash
# Backup Redis RDB
docker run --rm -v policy-bot_redis_data:/data -v $(pwd):/backup \
  alpine cp /data/dump.rdb /backup/redis-backup.rdb
```

### Full Backup Script

```bash
#!/bin/bash
BACKUP_DIR="/backups/policy-bot/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# SQLite
sqlite3 data/policy-bot.db ".backup $BACKUP_DIR/policy-bot.db"

# Global docs
tar -czvf $BACKUP_DIR/global-docs.tar.gz data/global-docs/

# Threads (optional - large)
tar -czvf $BACKUP_DIR/threads.tar.gz data/threads/

# ChromaDB
docker run --rm -v policy-bot_chroma_data:/data -v $BACKUP_DIR:/backup \
  alpine tar czvf /backup/chroma.tar.gz -C /data .
```

---

## 10. Data Lifecycle

### User Data

| Event | Action |
|-------|--------|
| User created | Insert users, optionally user_subscriptions |
| User deleted | CASCADE deletes threads, messages, uploads, subscriptions |
| Role changed | Update users.role, may affect access |

### Document Data

| Event | Action |
|-------|--------|
| Document uploaded | Insert documents, document_categories, ChromaDB chunks |
| Document deleted | Remove from documents, document_categories, ChromaDB |
| Categories changed | Update document_categories, reindex in ChromaDB |
| Re-ingested | Delete old ChromaDB chunks, create new ones |

### Thread Data

| Event | Action |
|-------|--------|
| Thread created | Insert threads, thread_categories |
| Message added | Insert messages, update threads.updated_at (trigger) |
| Thread deleted | CASCADE deletes messages, thread_uploads, thread_outputs |

### Cache Data

| Data Type | TTL | Notes |
|-----------|-----|-------|
| Query cache | Configurable | Invalidated on document changes |
| Tavily cache | Configurable | Separate TTL from RAG cache |
| Sessions | 24 hours | Auto-expire |

---

## 11. Constraints & Validation

### User Constraints

| Constraint | Value |
|------------|-------|
| Email | Unique, required |
| Role | `admin`, `superuser`, or `user` |
| Max admins | Unlimited |

### Category Constraints

| Constraint | Value |
|------------|-------|
| Name | Unique, required |
| Slug | Auto-generated, unique |

### Document Constraints

| Constraint | Admin Uploads | User Uploads |
|------------|---------------|--------------|
| Max file size | 50 MB | 5 MB |
| Allowed types | PDF only | PDF only |
| Max per thread | N/A | 3 files |

### Thread Constraints

| Constraint | Value |
|------------|-------|
| Max threads per user | Unlimited |
| Max messages per thread | Unlimited |
| Title max length | 100 characters |

---

## 12. Migration from JSON Files

If migrating from the previous JSON-based storage:

```typescript
// Migration steps:
// 1. Run schema.sql to create tables
// 2. Import allowed-users.json → users table
// 3. Import global-docs/registry.json → documents table
// 4. Create default category if none exist
// 5. Map all documents to default category
```

The migration is handled automatically on first run by checking for existing JSON files.
