# Policy Bot - Solution Architecture

## Executive Summary

Policy Bot is a RAG-based (Retrieval-Augmented Generation) chatbot designed to help government staff query policy documents and check document compliance. It combines local vector storage for document retrieval with multi-provider LLM support via LiteLLM proxy for intelligent responses, organized by a category-based document system with role-based access control.

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
│                    TRAEFIK REVERSE PROXY                                │
│              (TLS Termination, Let's Encrypt SSL)                       │
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
│                       LITELLM PROXY                                     │
│           (Multi-Provider LLM Gateway - OpenAI Compatible)              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Model Routing: openai/*, mistral/*, ollama/*                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
           │
           ├────────────────────┬────────────────────┐
           ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   OPENAI API    │  │   MISTRAL AI    │  │  OLLAMA (Local) │
│  gpt-4.1-mini   │  │ mistral-large-3 │  │   llama3.2      │
│  gpt-4.1        │  │ mistral-small   │  │   qwen2.5       │
│  gpt-4.1-nano   │  │ ministral-8b    │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │ text-embedding- │  │  Tavily API     │  │   whisper-1     │          │
│  │ 3-large (3072d) │  │  (Web Search)   │  │  (Transcribe)   │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
│  ┌─────────────────┐  ┌─────────────────┐                               │
│  │   Cohere API    │  │ Local Reranker  │                               │
│  │   (Reranking)   │  │ (Transformers.js│                               │
│  └─────────────────┘  └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15, React 19, Tailwind CSS | UI Framework |
| Backend | Next.js API Routes | REST API |
| Database | SQLite (better-sqlite3) | Metadata storage |
| LLM Gateway | LiteLLM Proxy | Multi-provider LLM abstraction (OpenAI-compatible API) |
| LLM - OpenAI | GPT-4.1, GPT-4.1-mini, GPT-4.1-nano | Chat completions with function calling |
| LLM - Mistral | mistral-large-3, mistral-small-3.2, ministral-8b | Alternative LLM provider |
| LLM - Local | Ollama (llama3.2, qwen2.5) | Self-hosted models, no API cost |
| Embeddings | OpenAI text-embedding-3-large | Vector embeddings (3072d) |
| Transcription | OpenAI whisper-1 | Voice-to-text |
| OCR | Azure Document Intelligence, Mistral OCR | PDF/image text extraction |
| Web Search | Tavily API (optional) | Real-time web search via function calling |
| Reranking | Cohere API, Transformers.js | Chunk reranking for improved relevance |
| Vector DB | ChromaDB | Category-based document embeddings storage |
| Cache | Redis 7 | Query caching (RAG + Tavily), sessions |
| Auth | NextAuth + Azure AD + Google | Multi-provider SSO |
| Storage | Local Filesystem | Thread messages, uploaded PDFs |
| Reverse Proxy | Traefik v3.0 | TLS termination, Let's Encrypt SSL |
| Deployment | Docker Compose | Container orchestration |

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
│ Rerank Chunks   │──── If reranker enabled (Cohere or local)
│ (Optional)      │     Re-score chunks by query relevance
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

**Reranker Integration**: When enabled, retrieved chunks are re-scored using either:
- **Cohere API** (`rerank-english-v3.0`): Fast, API-based reranking
- **Local Transformers.js** (`Xenova/all-MiniLM-L6-v2`): No API cost, slower first load

Reranking improves result quality by using a cross-encoder model to score each chunk against the query, then filtering by minimum score threshold.

### 3. Document Ingestion

Documents are ingested with category assignments. Two ingestion paths are supported:

#### File Upload (PDF, DOCX, Images)
```
File Upload
    │
    ▼
┌─────────────────┐
│ Extract Text    │
│ (Mistral OCR or │
│  Azure DI)      │
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

#### Text Content Upload (Direct Text)
```
Text Content
    │
    ▼
┌─────────────────┐
│ Save as .txt    │
│ file to         │
│ global-docs/    │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Chunk Text      │  ◀── Bypasses OCR/extraction
│ (Configurable   │      (text is already plain)
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

**Note**: Text content upload is more efficient than file upload as it skips the OCR/document extraction step, directly chunking the provided text.

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
- Upload documents (PDF files or text content) to assigned categories only
- Cannot upload global documents
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
   a. Embed query using text-embedding-3-large
   b. Search ChromaDB collections for subscribed categories
   c. Include global documents from all category searches
   d. If reranker enabled, re-score chunks with Cohere/local model
   e. If user doc exists, extract and include relevant text
   f. Build context with conversation history
   g. Generate response with LLM via LiteLLM (function calling enabled)
   h. If needed, call Tavily for web search
7. Cache response
8. Save message to thread
9. Return response with source citations
```

### Document Upload Flow (Admin)

Admin can upload documents via two methods: file upload or text content paste.

#### File Upload
```
1. Admin accesses /admin page - Documents tab
2. Admin clicks Upload, selects "File Upload" tab
3. Admin selects file (PDF, DOCX, XLSX, PPTX, or images)
4. Category selection modal appears
   - Select one or more categories
   - Or mark as "Global" for all categories
5. Admin submits upload
6. Backend validates file type and size (≤ 50MB)
7. Saves to global-docs folder
8. Creates SQLite document record
9. Triggers ingestion pipeline:
   a. Extract text (Mistral OCR or Azure DI)
   b. Chunk text with current settings
   c. Create embeddings
   d. Store in appropriate ChromaDB collections
10. Update document status to "ready"
```

#### Text Content Upload
```
1. Admin accesses /admin page - Documents tab
2. Admin clicks Upload, selects "Text Content" tab
3. Admin enters:
   - Document name (required, max 255 chars)
   - Text content (required, min 10 chars, max 10MB)
4. Category selection available
   - Select one or more categories
   - Or mark as "Global" for all categories
5. Admin submits
6. Backend validates name and content
7. Saves content as .txt file to global-docs folder
8. Creates SQLite document record
9. Triggers direct text ingestion (bypasses OCR):
   a. Chunk text directly
   b. Create embeddings
   c. Store in appropriate ChromaDB collections
10. Update document status to "ready"
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

### 8. Dynamic Branding System
- **Sidebar branding**: Admin-configurable bot name and icon stored in SQLite settings
- **Chat header**: Dynamic based on user's category subscriptions:
  - Single subscription: "[Category] Assistant"
  - Multiple subscriptions: "GEA Global Assistant"
  - No subscriptions (admin): Falls back to configured branding
- **Preset icons**: 11 industry-specific icons (government, operations, finance, etc.)
- **Rationale**: Allows deployment customization for different organizations while providing context-aware naming for users

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
| Reranker results | Configurable (1 hour default) | Redis |
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
- LLM API usage tracking (via LiteLLM metrics)
- ChromaDB query latency metrics
- Error rate dashboards
- SQLite query performance monitoring

---

## LiteLLM Multi-Provider Architecture

Policy Bot uses LiteLLM as a unified gateway to multiple LLM providers, enabling seamless switching between models without code changes.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS APPLICATION                         │
│                                                                 │
│  OPENAI_BASE_URL=http://litellm:4000/v1                        │
│  (Uses standard OpenAI SDK)                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LITELLM PROXY                              │
│                   (Port 4000, Docker)                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Model Routing via litellm_config.yaml                    │  │
│  │  - gpt-4.1       → openai/gpt-4.1                        │  │
│  │  - gpt-4.1-mini  → openai/gpt-4.1-mini                   │  │
│  │  - gpt-4.1-nano  → openai/gpt-4.1-nano                   │  │
│  │  - mistral-large-3    → mistral/mistral-large-latest     │  │
│  │  - mistral-small-3.2  → mistral/mistral-small-latest     │  │
│  │  - ministral-8b       → mistral/ministral-8b-latest      │  │
│  │  - ollama-llama3.2    → ollama/llama3.2                  │  │
│  │  - ollama-qwen2.5     → ollama/qwen2.5                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   OpenAI    │      │  Mistral AI │      │   Ollama    │
│  api.openai │      │ api.mistral │      │  localhost  │
│    .com     │      │    .ai      │      │   :11434    │
└─────────────┘      └─────────────┘      └─────────────┘
```

### Benefits

1. **Unified API**: Single OpenAI-compatible endpoint for all providers
2. **Hot-Swappable Models**: Change models via admin UI without redeployment
3. **Cost Optimization**: Use cheaper models for simple queries
4. **Fallback Support**: Can configure model fallbacks in LiteLLM
5. **Local Models**: Run Ollama models for zero API cost during development

### Model Presets

Admins can select from pre-configured model presets in the Settings page:

| Preset | Model | Use Case |
|--------|-------|----------|
| GPT-4.1 (High Performance) | gpt-4.1 | Complex policy analysis, 1M context |
| GPT-4.1 Mini (Balanced) | gpt-4.1-mini | Most policy queries, good accuracy |
| GPT-4.1 Nano (Cost-Effective) | gpt-4.1-nano | Simple queries, fastest response |
| Mistral Large 3 | mistral-large-3 | Strong reasoning, 256K context |
| Mistral Small 3.2 | mistral-small-3.2 | Routine queries, cost-effective |
| Ministral 8B | ministral-8b | Simplest queries, lowest cost |
| Ollama Llama 3.2 (Local) | ollama-llama3.2 | Development, no API cost |
| Ollama Qwen 2.5 (Local) | ollama-qwen2.5 | Development, excellent reasoning |

### Configuration

LiteLLM configuration is stored in `litellm-proxy/litellm_config.yaml`:

```yaml
model_list:
  - model_name: gpt-4.1-mini
    litellm_params:
      model: openai/gpt-4.1-mini
      api_key: os.environ/OPENAI_API_KEY

  - model_name: mistral-large-3
    litellm_params:
      model: mistral/mistral-large-latest
      api_key: os.environ/MISTRAL_API_KEY

  - model_name: ollama-llama3.2
    litellm_params:
      model: ollama/llama3.2
      api_base: http://host.docker.internal:11434
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_BASE_URL` | Set to `http://litellm:4000/v1` in Docker |
| `OPENAI_API_KEY` | Required for OpenAI models |
| `MISTRAL_API_KEY` | Required for Mistral models |
| `COHERE_API_KEY` | Required for Cohere reranking (optional) |

---

## Docker Deployment Architecture

### Container Services

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOCKER COMPOSE STACK                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  traefik (policy-bot-traefik)                           │   │
│  │  - Reverse proxy, TLS termination                       │   │
│  │  - Let's Encrypt SSL certificates                       │   │
│  │  - Ports: 80, 443                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  app (policy-bot-app)                                   │   │
│  │  - Next.js 15 application                               │   │
│  │  - Port: 3000 (internal)                                │   │
│  │  - Volume: app_data:/app/data                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │              │              │                         │
│         ▼              ▼              ▼                         │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │  chroma   │  │   redis   │  │  litellm  │  │ (volumes) │   │
│  │  :8000    │  │   :6379   │  │   :4000   │  │           │   │
│  │ chromadb/ │  │  redis:7  │  │ berriai/  │  │ app_data  │   │
│  │  chroma   │  │  alpine   │  │ litellm   │  │ chroma_   │   │
│  └───────────┘  └───────────┘  └───────────┘  │ redis_    │   │
│                                               │ letsencrypt│   │
│                                               └───────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Volume Persistence

| Volume | Mount Point | Contents |
|--------|-------------|----------|
| `app_data` | `/app/data` | SQLite database, uploaded documents |
| `chroma_data` | `/chroma/chroma` | Vector embeddings |
| `redis_data` | `/data` | Redis AOF persistence |
| `letsencrypt` | `/letsencrypt` | SSL certificates |

### Health Checks

- **Redis**: `redis-cli ping` every 30s
- **LiteLLM**: HTTP health endpoint every 30s with 30s start period
- **App**: Depends on Redis (healthy) and LiteLLM (healthy)

---

## Admin Dashboard

The admin dashboard provides a comprehensive interface for system management with five main tabs:

### Dashboard Tab (Statistics)

Real-time system overview:
- **Database Statistics**: Users, categories, documents, threads, messages counts
- **ChromaDB Status**: Collections count, total vectors, connection status
- **Storage Usage**: Total bytes, documents/threads breakdown, percentage used
- **Recent Activity**: Document uploads, user additions, setting changes

### Documents Tab

- Upload files (PDF, DOCX, XLSX, PPTX, images) or text content
- Assign documents to categories or mark as global
- View processing status (processing/ready/error)
- Reindex individual documents or all documents
- Delete documents and their embeddings

### Categories Tab

- Create, edit, delete categories
- View document counts per category
- Manage category slugs for URL routing

### Users Tab

- Add users with role assignment (admin/superuser/user)
- Manage category subscriptions per user
- Assign categories to super users
- View subscription status (active/inactive)

### Settings Tab

Seven configuration sections accessible via sidebar:

| Section | Configuration |
|---------|--------------|
| **System Prompt** | RAG instruction customization |
| **LLM Settings** | Model selection, temperature, max tokens |
| **RAG Settings** | Chunk size, overlap, similarity threshold, caching |
| **Acronyms** | Query expansion mappings (e.g., EA → enterprise architecture) |
| **Web Search** | Tavily API configuration and search parameters |
| **Branding** | Bot name and icon for sidebar |
| **Reranker** | Cohere/local provider, score thresholds |

---

## Configuration Defaults

Current default values from `config/defaults.json`:

### RAG Settings
| Setting | Default | Description |
|---------|---------|-------------|
| topKChunks | 15 | Number of chunks to retrieve |
| maxContextChunks | 10 | Max chunks in LLM context |
| similarityThreshold | 0.5 | Minimum similarity score |
| chunkSize | 1200 | Characters per chunk |
| chunkOverlap | 200 | Overlap between chunks |
| cacheTTLSeconds | 3600 | Query cache TTL (1 hour) |

### LLM Settings
| Setting | Default | Description |
|---------|---------|-------------|
| model | gpt-4.1-mini | Default LLM model |
| temperature | 0.2 | Response randomness |
| maxTokens | 2000 | Max response tokens |

### Reranker Settings
| Setting | Default | Description |
|---------|---------|-------------|
| enabled | false | Enable chunk reranking |
| provider | cohere | Reranker provider (cohere/local) |
| topKForReranking | 50 | Chunks to rerank |
| minRerankerScore | 0.3 | Minimum rerank score |

### Embedding Settings
| Setting | Default | Description |
|---------|---------|-------------|
| model | text-embedding-3-large | Embedding model |
| dimensions | 3072 | Vector dimensions |
