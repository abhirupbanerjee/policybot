# Policy Bot - Solution Architecture

## Executive Summary

Policy Bot is a RAG-based (Retrieval-Augmented Generation) chatbot designed to help government staff query policy documents and check document compliance. It combines local vector storage for document retrieval with OpenAI's language models for intelligent responses, organized by a category-based document system with role-based access control.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USERS                                      │
│              (Admin / Super User / Regular User)                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS 15 APPLICATION                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Chat UI   │  │  Admin UI   │  │ Super User  │  │    Auth     │     │
│  │  (React)    │  │  (React)    │  │     UI      │  │ (NextAuth)  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         API ROUTES                              │    │
│  │  /api/chat  │ /api/threads │ /api/admin │ /api/superuser       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      CORE LIBRARIES                             │    │
│  │  RAG Pipeline │ Ingest │ DB Layer │ OpenAI │ Auth │ Storage    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
           │            │            │            │
           ▼            ▼            ▼            ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│     SQLITE      │ │    CHROMADB     │ │     REDIS       │ │   FILESYSTEM    │
│   (Metadata)    │ │  Vector Store   │ │  Cache/Session  │ │  Threads/Docs   │
│ Users,Cats,Docs │ │  (Embeddings)   │ │                 │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           OPENAI API                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │  gpt-5-mini     │  │ text-embedding- │  │   whisper-1     │          │
│  │  (Chat + Tools) │  │ 3-large (3072d) │  │  (Transcribe)   │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL APIS                                      │
│  ┌─────────────────┐  ┌─────────────────┐                               │
│  │ mistral-ocr     │  │  Tavily API     │                               │
│  │ (PDF extract)   │  │  (Web Search)   │                               │
│  └─────────────────┘  └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15, React, Tailwind CSS | UI Framework |
| Backend | Next.js API Routes | REST API |
| Database | SQLite (better-sqlite3) | Metadata storage |
| LLM | OpenAI GPT-5 Mini (configurable) | Chat completions with function calling |
| LLM Alternatives | OpenAI GPT-5, GPT-4.1 Mini | Advanced reasoning / Fast queries |
| Embeddings | OpenAI text-embedding-3-large | Vector embeddings (3072d) |
| Transcription | OpenAI whisper-1 | Voice-to-text |
| OCR | Mistral OCR (fallback: pdf-parse) | PDF text extraction |
| Web Search | Tavily API (optional) | Real-time web search via function calling |
| Vector DB | ChromaDB | Category-based document embeddings storage |
| Cache | Redis | Query caching (RAG + Tavily), sessions |
| Auth | NextAuth + Azure AD + Google | Multi-provider SSO |
| Storage | Local Filesystem | Thread messages, uploaded PDFs |
| Deployment | Docker, Traefik | Containerization, TLS |

---

## Core Components

### 1. Category System

Documents are organized into categories, each with its own ChromaDB collection:

```
┌────────────────────────────────────────────────────────────┐
│                    CATEGORY STRUCTURE                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐│
│  │   HR Category   │  │ Finance Category│  │ IT Category  ││
│  │  ─────────────  │  │  ─────────────  │  │ ──────────── ││
│  │ ChromaDB:       │  │ ChromaDB:       │  │ ChromaDB:    ││
│  │ policy_hr       │  │ policy_finance  │  │ policy_it    ││
│  │                 │  │                 │  │              ││
│  │ Docs:           │  │ Docs:           │  │ Docs:        ││
│  │ - Leave Policy  │  │ - Budget Guide  │  │ - IT Security││
│  │ - HR Handbook   │  │ - Expenses      │  │ - VPN Guide  ││
│  └─────────────────┘  └─────────────────┘  └──────────────┘│
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              GLOBAL DOCUMENTS                         │  │
│  │  Indexed into ALL category collections                │  │
│  │  - Company Policies                                   │  │
│  │  - Code of Conduct                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### 2. RAG Pipeline

The Retrieval-Augmented Generation pipeline now includes category awareness:

```
User Query
    │
    ▼
┌─────────────────┐
│ Get Thread      │──── Load category context from thread
│ Categories      │
└─────────────────┘
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
│ Query Category  │──── Search only relevant category collections
│ Collections     │     + Global documents
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Build Context   │◀──── Include user-uploaded doc (if any)
│ + Last 5 msgs   │
└─────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ Generate with OpenAI (function calling)     │
│ - GPT decides if web search needed          │
│ - Calls Tavily tool if enabled              │
│ - Combines RAG + Web sources                │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────┐
│ Cache Response  │
│ Return + Sources│  ◀── Sources tagged with [WEB] if from Tavily
└─────────────────┘
```

**Web Search Integration**: If Tavily is enabled in admin settings, the LLM can automatically trigger web searches using OpenAI function calling. Results are cached separately in Redis with configurable TTL (60 seconds to 1 month).

### 3. Document Ingestion

Documents are now ingested with category assignments:

```
PDF Upload
    │
    ▼
┌─────────────────┐
│ Extract Text    │
│ (Mistral OCR or │
│  pdf-parse)     │
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
│ (Configurable   │
│  size/overlap)  │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Batch Embed     │
│ All Chunks      │
└─────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ Store in ChromaDB                   │
│ - Global: ALL category collections  │
│ - Category: Specific collections    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────┐
│ Update SQLite   │
│ Document record │
└─────────────────┘
```

### 4. Thread Management

Threads provide conversation isolation and category-based document access:

- Each user has their own threads
- Threads can be assigned to specific categories
- Category assignment determines which documents are searchable
- User-uploaded PDFs are attached to threads
- Deleting a thread removes all associated data

### 5. Authentication Flow

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
│ Show Sign-In    │
│ (Azure AD or    │
│  Google OAuth)  │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Access Check    │──── Not Allowed ────▶ Deny Access
│                 │
│ Allowlist Mode: │
│  Check user in  │
│  SQLite users   │
│                 │
│ Domain Mode:    │
│  Check email    │
│  domain         │
└─────────────────┘
    │ Allowed
    ▼
┌─────────────────┐
│ Create Session  │
│ Assign Role     │
│ (admin/super/   │
│  user)          │
└─────────────────┘
```

### Access Control Modes

| Mode | Configuration | Description |
|------|---------------|-------------|
| **Allowlist** | `ACCESS_MODE=allowlist` | Only users explicitly added to SQLite can sign in |
| **Domain** | `ACCESS_MODE=domain` | Any user from allowed email domains can sign in |

---

## User Roles & Permissions

### Admin Users
- Full system access
- Can access `/admin` dashboard
- Manage all categories, documents, users
- Assign categories to super users
- Manage user subscriptions
- Configure system settings
- All standard user capabilities

### Super Users
- Can access `/superuser` dashboard
- Manage users subscribed to their assigned categories
- Add/remove user subscriptions for assigned categories
- Cannot manage other super users or admins
- All standard user capabilities

### Regular Users
- Query documents from subscribed categories
- Create/delete their own threads
- Upload PDFs for compliance checking (max 3 per thread, 5MB each)
- Voice input for queries
- View conversation history

---

## Data Flow Diagrams

### Query Flow (Category-Aware)

```
1. User types question or uses voice input
2. Frontend sends POST /api/chat with message + threadId
3. Backend retrieves thread and its category subscriptions
4. Backend retrieves conversation history (last 5 messages)
5. Backend checks if thread has uploaded document
6. RAG pipeline:
   a. Embed query
   b. Search ChromaDB collections for subscribed categories
   c. Include global documents from all category searches
   d. If user doc exists, extract and include relevant text
   e. Build context with conversation history
   f. Generate response with GPT (function calling enabled)
   g. If needed, call Tavily for web search
7. Cache response
8. Save message to thread
9. Return response with source citations
```

### Document Upload Flow (Admin)

```
1. Admin accesses /admin page - Documents tab
2. Admin clicks Upload, selects file
3. Modal appears with category selection
   - Select one or more categories
   - Or mark as "Global" for all categories
4. Admin submits upload
5. Backend validates PDF, size ≤ 50MB
6. Saves to global-docs folder
7. Creates SQLite document record
8. Triggers ingestion pipeline:
   a. Extract text (Mistral OCR or pdf-parse)
   b. Chunk text with current settings
   c. Create embeddings
   d. Store in appropriate ChromaDB collections
9. Update document status to "ready"
```

### User Subscription Management

```
Admin/Super User manages subscriptions:

1. Open user management modal
2. For regular users:
   - Select categories to subscribe
   - User gets access to those category documents
3. For super users (admin only):
   - Assign categories to manage
   - Super user can then manage users in those categories
4. Changes update SQLite relationships
5. User's threads now search new category collections
```

---

## Key Design Decisions

### 1. SQLite for Metadata
- **Replaces**: JSON file storage for users, documents, categories
- **Benefits**:
  - ACID transactions for data integrity
  - Efficient queries with indexes
  - Relationships between entities (users, categories, subscriptions)
  - Single file, easy backup
- **Tables**: users, categories, documents, user_subscriptions, super_user_categories, document_categories, config

### 2. Category-Based ChromaDB Collections
- Each category gets its own ChromaDB collection
- Collection naming: `policy_{category_slug}`
- Global documents indexed into all category collections
- Enables fine-grained access control

### 3. Three-Tier Role System
- **Admin**: Full system access
- **Super User**: Delegated user management for specific categories
- **User**: Access to subscribed categories only
- Enables organizational hierarchy for large deployments

### 4. Hybrid Storage Strategy
- **SQLite**: Structured metadata (users, categories, documents, config)
- **ChromaDB**: Vector embeddings for semantic search
- **Redis**: Fast caching and session management
- **Filesystem**: Thread messages and PDF files

### 5. Multi-Turn Context (5 Messages)
- Enables follow-up questions like "what about section 3?"
- Balances context window usage with coherent conversation
- Stored locally, not in expensive token-based storage

### 6. Thread-Based Document Isolation
- User documents are scoped to threads
- Prevents cross-contamination between compliance checks
- Simple cleanup: delete thread = delete everything

### 7. Native Browser APIs for Voice
- MediaRecorder API for voice capture
- No additional dependencies
- Works across modern browsers
- Graceful fallback for unsupported browsers

---

## Security Considerations

### Authentication
- Multi-provider OAuth (Azure AD and Google)
- Two access control modes: allowlist (specific users) or domain-based
- Session-based authentication via NextAuth
- Role-based access control stored in SQLite
- Admin users initially seeded from ADMIN_EMAILS environment variable

### Authorization
- Three-tier role system (admin, superuser, user)
- Category-based document access
- Super users can only manage their assigned categories
- Users can only access subscribed category documents

### Data Isolation
- Users can only access their own threads
- Thread paths include userId: `data/threads/{userId}/{threadId}/`
- All API routes validate session and role before processing
- Category subscriptions control document visibility

### Input Validation
- File type validation (PDF only)
- File size limits enforced server-side
- Query sanitization before processing
- SQL injection prevention via parameterized queries

### Environment Security
- Secrets in environment variables
- `.env` files gitignored
- Different configs for dev/preprod/prod

---

## Performance Optimizations

### Caching Strategy
| Data | TTL | Storage |
|------|-----|---------|
| Query responses | Configurable (1 hour default) | Redis |
| Tavily results | Configurable (1 day default) | Redis |
| Sessions | 24 hours | Redis |
| Embeddings | Permanent | ChromaDB |

### Batch Processing
- Document embeddings created in batch (100 chunks at a time)
- Reduces OpenAI API calls during ingestion

### Database Indexing
- SQLite indexes on frequently queried columns
- ChromaDB HNSW index for vector search

### Lazy Loading
- Thread history loaded on demand
- Source citations expandable (not pre-loaded)

---

## Scalability Notes

### Current Design (Pilot Phase)
- Single VM deployment
- Local SQLite database
- Local filesystem storage
- Suitable for 1-50 concurrent users

### Future Scaling Options
1. **Database**: Migrate SQLite to PostgreSQL for multi-instance support
2. **Horizontal Scaling**: Move thread storage to shared database
3. **CDN**: Static asset caching via Cloudflare
4. **Queue Processing**: Background job queue for document ingestion
5. **Multi-Region**: Replicate ChromaDB for geographic distribution

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
- SQLite query performance monitoring
