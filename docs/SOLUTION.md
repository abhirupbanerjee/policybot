# Policy Bot - Solution Architecture

## Executive Summary

Policy Bot is a RAG-based (Retrieval-Augmented Generation) chatbot designed to help government staff query policy documents and check document compliance. It combines local vector storage for document retrieval with OpenAI's language models for intelligent responses.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USERS                                      │
│                    (Admin / Non-Admin Staff)                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS 15 APPLICATION                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Chat UI   │  │  Admin UI   │  │   Thread    │  │    Auth     │     │
│  │  (React)    │  │  (React)    │  │  Sidebar    │  │ (NextAuth)  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         API ROUTES                              │    │
│  │  /api/chat  │  /api/threads  │  /api/admin  │  /api/transcribe  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      CORE LIBRARIES                             │    │
│  │   RAG Pipeline  │  Ingest  │  Storage  │  OpenAI  │  Auth       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    CHROMADB     │  │     REDIS       │  │   FILESYSTEM    │
│  Vector Store   │  │  Cache/Session  │  │  Threads/Docs   │
│  (Embeddings)   │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           OPENAI API                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │  gpt-4o-mini    │  │ text-embedding- │  │   whisper-1     │          │
│  │  (Chat)         │  │ 3-small         │  │  (Transcribe)   │          │ 
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15, React, Tailwind CSS | UI Framework |
| Backend | Next.js API Routes | REST API |
| LLM | OpenAI gpt-4o-mini | Chat completions |
| Embeddings | OpenAI text-embedding-3-small | Vector embeddings |
| Transcription | OpenAI whisper-1 | Voice-to-text |
| Vector DB | ChromaDB | Document embeddings storage |
| Cache | Redis | Query caching, sessions |
| Auth | NextAuth + Azure AD | SSO Authentication |
| Storage | Local Filesystem | Thread data, uploaded PDFs |
| Deployment | Docker, Traefik | Containerization, TLS |

---

## Core Components

### 1. RAG Pipeline

The Retrieval-Augmented Generation pipeline is the core of the system:

```
User Query
    │
    ▼
┌─────────────────┐
│ Check Cache     │──── Cache Hit ────▶ Return Cached Response
└─────────────────┘
    │ Cache Miss
    ▼
┌─────────────────┐
│ Create Query    │
│ Embedding       │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Query ChromaDB  │
│ (Top 5 chunks)  │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Build Context   │◀──── Include user-uploaded doc (if any)
│ + Last 5 msgs   │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Generate with   │
│ gpt-4o-mini     │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Cache Response  │
│ Return + Sources│
└─────────────────┘
```

### 2. Document Ingestion

```
PDF Upload
    │
    ▼
┌─────────────────┐
│ Extract Text    │
│ (pdf-parse)     │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Track Pages     │
│ Boundaries      │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Chunk Text      │
│ (500 chars,     │
│  50 overlap)    │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Batch Embed     │
│ All Chunks      │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Store in        │
│ ChromaDB        │
└─────────────────┘
```

### 3. Thread Management

Threads provide conversation isolation and document attachment:

- Each user has their own threads
- Threads store conversation history locally
- User-uploaded PDFs are attached to threads
- Deleting a thread removes all associated data

### 4. Authentication Flow

```
User Access
    │
    ▼
┌─────────────────┐
│ Check Session   │──── Valid Session ────▶ Allow Access
└─────────────────┘
    │ No Session
    ▼
┌─────────────────┐
│ Redirect to     │
│ Azure AD Login  │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Domain Check    │──── Invalid Domain ────▶ Deny Access
│ (abhirup.app,   │
│  gov.gd)        │
└─────────────────┘
    │ Valid
    ▼
┌─────────────────┐
│ Create Session  │
│ Check Admin     │
└─────────────────┘
```

---

## User Roles & Permissions

### Admin Users
- Identified by email in `ADMIN_EMAILS` environment variable
- Can access `/admin` page
- Full CRUD on global policy documents
- Re-index documents in ChromaDB
- All standard user capabilities

### Non-Admin Users
- Query global policy documents
- Create/delete their own threads
- Upload PDFs for compliance checking (max 3 per thread, 5MB each)
- Voice input for queries
- View conversation history

---

## Data Flow Diagrams

### Query Flow (Non-Admin)

```
1. User types question or uses voice input
2. Frontend sends POST /api/chat with message + threadId
3. Backend retrieves conversation history (last 5 messages)
4. Backend checks if thread has uploaded document
5. RAG pipeline:
   a. Embed query
   b. Search ChromaDB for relevant chunks
   c. If user doc exists, extract and include relevant text
   d. Build context with conversation history
   e. Generate response with gpt-4o-mini
6. Cache response
7. Save message to thread
8. Return response with source citations
```

### Document Upload Flow (Non-Admin)

```
1. User uploads PDF in chat interface
2. Frontend sends POST /api/threads/[id]/upload
3. Backend validates:
   - File is PDF
   - Size ≤ 5MB
   - Thread has < 3 uploads
4. Save PDF to thread's uploads folder
5. Return success + filename
6. User can now ask questions about the document
```

### Admin Document Management

```
1. Admin accesses /admin page
2. Frontend fetches GET /api/admin/documents
3. Admin can:
   a. Upload new policy doc (POST /api/admin/documents)
      - Validates PDF, size ≤ 50MB
      - Saves to global-docs folder
      - Triggers ingestion pipeline
   b. Delete doc (DELETE /api/admin/documents/[id])
      - Removes from filesystem
      - Removes from ChromaDB
   c. Re-index doc (POST /api/admin/documents/[id]/reindex)
      - Re-runs ingestion pipeline
```

---

## Key Design Decisions

### 1. Hybrid Storage Strategy
- **ChromaDB**: Vector embeddings for semantic search
- **Redis**: Fast caching and session management
- **Filesystem**: Thread data and PDF storage

**Rationale**: Separating concerns allows optimal storage for each data type. Filesystem storage for threads is simple, debuggable, and doesn't require additional database setup.

### 2. OpenAI Chat Completions API (Not Assistants)
- Direct control over RAG pipeline
- Lower latency
- More predictable costs
- Simpler debugging

### 3. Multi-Turn Context (5 Messages)
- Enables follow-up questions like "what about section 3?"
- Balances context window usage with coherent conversation
- Stored locally, not in expensive token-based storage

### 4. Thread-Based Document Isolation
- User documents are scoped to threads
- Prevents cross-contamination between compliance checks
- Simple cleanup: delete thread = delete everything

### 5. Native Browser APIs for Voice
- MediaRecorder API for voice capture
- No additional dependencies
- Works across modern browsers
- Graceful fallback for unsupported browsers

---

## Security Considerations

### Authentication
- Azure AD SSO with domain whitelist
- Session-based authentication via NextAuth
- Admin role determined by email list (simple but effective)

### Data Isolation
- Users can only access their own threads
- Thread paths include userId: `data/threads/{userId}/{threadId}/`
- All API routes validate session before processing

### Input Validation
- File type validation (PDF only)
- File size limits enforced server-side
- Query sanitization before processing

### Environment Security
- Secrets in environment variables
- `.env` files gitignored
- Different configs for dev/preprod/prod

---

## Performance Optimizations

### Caching Strategy
| Data | TTL | Storage |
|------|-----|---------|
| Query responses | 1 hour | Redis |
| Sessions | 24 hours | Redis |
| Embeddings | Permanent | ChromaDB |

### Batch Processing
- Document embeddings created in batch
- Reduces OpenAI API calls during ingestion

### Lazy Loading
- Thread history loaded on demand
- Source citations expandable (not pre-loaded)

---

## Scalability Notes

### Current Design (Pilot Phase)
- Single VM deployment
- Local filesystem storage
- Suitable for 1-10 concurrent users

### Future Scaling Options
1. **Horizontal Scaling**: Move thread storage to PostgreSQL/MongoDB
2. **CDN**: Static asset caching via Cloudflare
3. **Queue Processing**: Background job queue for document ingestion
4. **Multi-Region**: Replicate ChromaDB for geographic distribution

---

## Error Handling Strategy

### User-Facing Errors
- Clear messages: "Service unavailable", "File too large"
- Retry buttons for transient failures
- Loading states for long operations

### Backend Errors
- Structured logging
- Graceful degradation (e.g., if Redis is down, skip caching)
- Error boundaries in React components

---

## Monitoring & Observability (Future)

Recommended additions for production:
- Request logging with correlation IDs
- OpenAI API usage tracking
- ChromaDB query latency metrics
- Error rate dashboards
