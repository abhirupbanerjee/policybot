# Policy Bot - Database & Storage Architecture

## Overview

Policy Bot uses a hybrid storage approach:
- **ChromaDB**: Vector embeddings for semantic search
- **Redis**: Caching and session management
- **Filesystem**: Thread data and document storage

---

## 1. Filesystem Storage

### Directory Structure

```
data/
├── threads/
│   └── {userId}/
│       └── {threadId}/
│           ├── metadata.json
│           ├── messages.json
│           └── uploads/
│               ├── document1.pdf
│               ├── document2.pdf
│               └── document3.pdf
└── global-docs/
    ├── Leave_Policy.pdf
    ├── Travel_Guidelines.pdf
    └── HR_Handbook.pdf
```

### Thread Metadata Schema

**File**: `data/threads/{userId}/{threadId}/metadata.json`

```typescript
interface ThreadMetadata {
  id: string;              // UUID v4
  userId: string;          // User email or ID from session
  title: string;           // Auto-generated from first message
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
  uploadCount: number;     // Number of uploaded files (max 3)
}
```

**Example**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user@abhirup.app",
  "title": "Leave Policy Questions",
  "createdAt": "2024-12-02T14:30:00.000Z",
  "updatedAt": "2024-12-02T15:45:00.000Z",
  "uploadCount": 1
}
```

### Messages Schema

**File**: `data/threads/{userId}/{threadId}/messages.json`

```typescript
interface Message {
  id: string;              // UUID v4
  role: 'user' | 'assistant';
  content: string;         // Message text (markdown supported)
  sources?: Source[];      // Only for assistant messages
  attachments?: string[];  // Filenames of attached documents
  timestamp: string;       // ISO 8601 timestamp
}

interface Source {
  documentName: string;    // e.g., "Leave_Policy.pdf"
  pageNumber: number;      // Page where chunk was found
  chunkText: string;       // Preview of the matched chunk
  score: number;           // Similarity score (0-1)
}
```

**Example**:
```json
[
  {
    "id": "msg-001",
    "role": "user",
    "content": "What is the annual leave entitlement?",
    "timestamp": "2024-12-02T14:30:00.000Z"
  },
  {
    "id": "msg-002",
    "role": "assistant",
    "content": "According to the Leave Policy document, employees are entitled to:\n\n- 20 days annual leave per year\n- Prorated for partial years\n- Must be approved by supervisor",
    "sources": [
      {
        "documentName": "Leave_Policy.pdf",
        "pageNumber": 3,
        "chunkText": "Annual leave entitlement is set at 20 working days per calendar year...",
        "score": 0.89
      }
    ],
    "timestamp": "2024-12-02T14:30:05.000Z"
  }
]
```

### Global Documents Registry

**File**: `data/global-docs/registry.json`

```typescript
interface DocumentRegistry {
  documents: GlobalDocument[];
}

interface GlobalDocument {
  id: string;              // UUID v4
  filename: string;        // Original filename
  filepath: string;        // Path relative to global-docs/
  size: number;            // File size in bytes
  chunkCount: number;      // Number of chunks in ChromaDB
  uploadedAt: string;      // ISO 8601 timestamp
  uploadedBy: string;      // Admin email
  status: 'processing' | 'ready' | 'error';
  errorMessage?: string;   // If status is 'error'
}
```

**Example**:
```json
{
  "documents": [
    {
      "id": "doc-001",
      "filename": "Leave_Policy.pdf",
      "filepath": "Leave_Policy.pdf",
      "size": 2411724,
      "chunkCount": 45,
      "uploadedAt": "2024-12-01T10:00:00.000Z",
      "uploadedBy": "mailabhirupbanerjee@gmail.com",
      "status": "ready"
    },
    {
      "id": "doc-002",
      "filename": "Travel_Guidelines.pdf",
      "filepath": "Travel_Guidelines.pdf",
      "size": 1887436,
      "chunkCount": 38,
      "uploadedAt": "2024-11-28T09:30:00.000Z",
      "uploadedBy": "mailabhirupbanerjee@gmail.com",
      "status": "ready"
    }
  ]
}
```

---

## 2. ChromaDB Schema

### Collection: `policy_documents`

ChromaDB stores vector embeddings for semantic search.

**Collection Configuration**:
```typescript
{
  name: "policy_documents",
  metadata: {
    "hnsw:space": "cosine"  // Cosine similarity for text embeddings
  }
}
```

### Document Schema

```typescript
interface ChromaDocument {
  id: string;           // Format: "{docId}-chunk-{index}"
  embedding: number[];  // 1536 dimensions (text-embedding-3-small)
  document: string;     // The actual chunk text
  metadata: {
    documentId: string;      // Parent document ID
    documentName: string;    // Original filename
    pageNumber: number;      // Page where chunk appears
    chunkIndex: number;      // Position in document
    source: 'global' | 'user';  // Document source type
    threadId?: string;       // Only for user uploads
    userId?: string;         // Only for user uploads
  }
}
```

**Example Entry**:
```json
{
  "id": "doc-001-chunk-15",
  "embedding": [0.023, -0.045, 0.012, ...],  // 1536 floats
  "document": "Annual leave entitlement is set at 20 working days per calendar year. Employees joining mid-year receive prorated leave based on their start date.",
  "metadata": {
    "documentId": "doc-001",
    "documentName": "Leave_Policy.pdf",
    "pageNumber": 3,
    "chunkIndex": 15,
    "source": "global"
  }
}
```

### Chunking Strategy

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Chunk Size | 500 characters | Balance between context and specificity |
| Overlap | 50 characters | Ensure continuity across chunks |
| Separators | `['\n\n', '\n', '. ', ' ', '']` | Preserve paragraph/sentence boundaries |

### Query Pattern

```typescript
// Query for relevant chunks
const results = await collection.query({
  queryEmbeddings: [queryEmbedding],
  nResults: 5,
  where: {
    // Optional: filter by source type
    "source": "global"
  },
  include: ["documents", "metadatas", "distances"]
});
```

---

## 3. Redis Schema

### Key Patterns

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `query:{hash}` | 1 hour | Cached RAG responses |
| `session:{token}` | 24 hours | User session data |

### Query Cache Schema

**Key**: `query:{md5(query.toLowerCase().trim())}`

```typescript
interface CachedQuery {
  answer: string;
  sources: Source[];
  cachedAt: string;  // ISO 8601 timestamp
}
```

**Example**:
```
Key: query:a1b2c3d4e5f6g7h8
Value: {
  "answer": "According to the Leave Policy...",
  "sources": [...],
  "cachedAt": "2024-12-02T14:30:00.000Z"
}
TTL: 3600 seconds
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
  };
  expires: string;  // ISO 8601 timestamp
}
```

---

## 4. TypeScript Interfaces

### Complete Type Definitions

```typescript
// src/types/index.ts

// ============ Core Types ============

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  isAdmin: boolean;
}

// ============ Thread Types ============

export interface Thread {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  uploadCount: number;
}

export interface ThreadWithMessages extends Thread {
  messages: Message[];
}

// ============ Message Types ============

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  attachments?: string[];
  timestamp: Date;
}

export interface Source {
  documentName: string;
  pageNumber: number;
  chunkText: string;
  score: number;
}

// ============ Document Types ============

export interface GlobalDocument {
  id: string;
  filename: string;
  filepath: string;
  size: number;
  chunkCount: number;
  uploadedAt: Date;
  uploadedBy: string;
  status: 'processing' | 'ready' | 'error';
  errorMessage?: string;
}

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: ChunkMetadata;
  embedding?: number[];
}

export interface ChunkMetadata {
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  source: 'global' | 'user';
  threadId?: string;
  userId?: string;
}

// ============ API Types ============

export interface ChatRequest {
  message: string;
  threadId: string;
}

export interface ChatResponse {
  message: Message;
  threadId: string;
}

export interface ThreadListResponse {
  threads: Thread[];
}

export interface UploadResponse {
  filename: string;
  size: number;
  uploadCount: number;
}

export interface AdminDocumentsResponse {
  documents: GlobalDocument[];
  totalChunks: number;
}

export interface TranscribeResponse {
  text: string;
  duration: number;
}

// ============ Error Types ============

export interface ApiError {
  error: string;
  details?: string;
  code?: string;
}
```

---

## 5. Data Flow Diagrams

### Thread Creation Flow

```
User Action: Create New Thread
         │
         ▼
┌─────────────────────┐
│ Generate Thread ID  │
│ (UUID v4)           │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ Create Directory    │
│ data/threads/{uid}/ │
│       {threadId}/   │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ Write metadata.json │
│ {title: "New...",   │
│  uploadCount: 0}    │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ Write messages.json │
│ []                  │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ Create uploads/     │
│ directory           │
└─────────────────────┘
```

### Message Flow with RAG

```
User Message
    │
    ▼
┌─────────────────────┐
│ Check for uploads   │
│ in thread           │
└─────────────────────┘
    │
    ├─── Has uploads ──▶ Extract text from PDFs
    │                          │
    ▼                          ▼
┌─────────────────────┐  ┌─────────────────────┐
│ Query ChromaDB      │  │ Create temp chunks  │
│ (global docs)       │  │ from user docs      │
└─────────────────────┘  └─────────────────────┘
    │                          │
    └──────────┬───────────────┘
               │
               ▼
    ┌─────────────────────┐
    │ Build context from  │
    │ all relevant chunks │
    └─────────────────────┘
               │
               ▼
    ┌─────────────────────┐
    │ Load last 5 msgs    │
    │ from messages.json  │
    └─────────────────────┘
               │
               ▼
    ┌─────────────────────┐
    │ Generate response   │
    │ with gpt-4o-mini    │
    └─────────────────────┘
               │
               ▼
    ┌─────────────────────┐
    │ Append to           │
    │ messages.json       │
    └─────────────────────┘
               │
               ▼
    ┌─────────────────────┐
    │ Update metadata     │
    │ (title if first,    │
    │  updatedAt)         │
    └─────────────────────┘
```

### Document Ingestion Flow

```
Admin Upload
    │
    ▼
┌─────────────────────┐
│ Validate PDF        │
│ (type, size ≤50MB)  │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Save to             │
│ data/global-docs/   │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Add to registry     │
│ status: processing  │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Extract text with   │
│ page boundaries     │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Chunk text          │
│ (500 chars, 50 ovlp)│
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Batch embed chunks  │
│ (OpenAI API)        │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Store in ChromaDB   │
│ with metadata       │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Update registry     │
│ status: ready       │
│ chunkCount: N       │
└─────────────────────┘
```

---

## 6. Indexes and Performance

### ChromaDB Index

ChromaDB automatically maintains an HNSW (Hierarchical Navigable Small World) index for fast approximate nearest neighbor search.

**Configuration**:
```typescript
{
  "hnsw:space": "cosine",     // Distance metric
  "hnsw:construction_ef": 200, // Build-time parameter
  "hnsw:search_ef": 100        // Query-time parameter
}
```

### Filesystem Performance

**Recommendations**:
1. Store `data/` on SSD for faster JSON read/write
2. Consider using async file operations
3. For high traffic, consider moving to SQLite or PostgreSQL

### Redis Performance

**Recommendations**:
1. Enable AOF persistence for data durability
2. Set appropriate `maxmemory` policy
3. Use connection pooling

---

## 7. Backup & Recovery

### Filesystem Backup

```bash
# Backup threads and documents
tar -czvf backup-$(date +%Y%m%d).tar.gz data/

# Restore
tar -xzvf backup-20241202.tar.gz -C /app/
```

### ChromaDB Backup

ChromaDB data is stored in a Docker volume. Backup the volume:

```bash
# Backup
docker run --rm -v policy-bot_chroma_data:/data -v $(pwd):/backup \
  alpine tar czvf /backup/chroma-backup.tar.gz -C /data .

# Restore
docker run --rm -v policy-bot_chroma_data:/data -v $(pwd):/backup \
  alpine tar xzvf /backup/chroma-backup.tar.gz -C /data
```

### Redis Backup

Redis data is stored in a Docker volume with RDB snapshots:

```bash
# Backup
docker run --rm -v policy-bot_redis_data:/data -v $(pwd):/backup \
  alpine cp /data/dump.rdb /backup/redis-backup.rdb

# Restore
docker run --rm -v policy-bot_redis_data:/data -v $(pwd):/backup \
  alpine cp /backup/redis-backup.rdb /data/dump.rdb
```

---

## 8. Data Lifecycle

### Thread Data

| Event | Retention |
|-------|-----------|
| Thread created | Indefinite |
| Thread deleted | Immediately removed |
| User uploads | Removed with thread |

### Cache Data

| Data Type | TTL |
|-----------|-----|
| Query cache | 1 hour |
| Session | 24 hours |

### Document Data

| Event | Action |
|-------|--------|
| Document uploaded | Indexed immediately |
| Document deleted | Removed from ChromaDB + filesystem |
| Document reindexed | Old chunks deleted, new chunks added |

---

## 9. Constraints & Validation

### User Uploads

| Constraint | Value |
|------------|-------|
| Max files per thread | 3 |
| Max file size | 5 MB |
| Allowed types | PDF only |

### Admin Uploads

| Constraint | Value |
|------------|-------|
| Max file size | 50 MB |
| Allowed types | PDF only |
| Max documents | Unlimited |

### Thread Limits

| Constraint | Value |
|------------|-------|
| Max threads per user | Unlimited |
| Max messages per thread | Unlimited |
| Title max length | 100 characters |
