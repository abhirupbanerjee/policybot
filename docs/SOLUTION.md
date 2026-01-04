# Policy Bot - Solution Architecture

Comprehensive architecture documentation for Policy Bot - an enterprise RAG platform for policy document management.

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
│  │  Model Routing: openai/*, mistral/*, gemini/*, ollama/*          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
           │
           ├────────────────────┬────────────────────┬────────────────────┐
           ▼                    ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   OPENAI API    │  │   MISTRAL AI    │  │  GOOGLE GEMINI  │  │  OLLAMA (Local) │
│  gpt-4.1 (V)    │  │ mistral-large-3 │  │ gemini-2.5-pro  │  │   llama3.2      │
│  gpt-4.1-mini(V)│  │   (V)           │  │   (V)           │  │   qwen2.5       │
│  gpt-4.1-nano(V)│  │ mistral-small   │  │ gemini-2.5-flash│  │   phi4          │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
                     (V) = Vision/Multimodal capable
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
| LLM - OpenAI | GPT-4.1, GPT-4.1-mini, GPT-4.1-nano | Chat completions with function calling + vision |
| LLM - Gemini | gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite | Fast inference with vision support |
| LLM - Mistral | mistral-large-3, mistral-small-3.2 | Alternative LLM provider with vision |
| LLM - Local | Ollama (llama3.2, qwen2.5, phi4) | Self-hosted models, no API cost |
| Embeddings | OpenAI text-embedding-3-large | Vector embeddings (3072d) |
| Transcription | OpenAI whisper-1 | Voice-to-text |
| OCR | Azure Document Intelligence, Mistral OCR | PDF/image text extraction |
| Web Search | Tavily API (optional) | Real-time web search via function calling |
| Data Sources | API + CSV integration | External data querying with visualization |
| Function APIs | OpenAI-format schemas | Dynamic function calling to external services |
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

### 2.1 Multimodal/Vision Support

When using a vision-capable model, users can upload images alongside their questions for visual analysis:

```
User uploads image + question
    │
    ▼
┌─────────────────┐
│ Read image as   │
│ base64 data     │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Build multimodal│──── Combines text context + image content
│ message content │
└─────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ Generate with Vision Model                   │
│ - GPT-4.1, Gemini 2.5, Mistral Large 3      │
│ - Image passed as base64 data URL           │
│ - Detail level: high for better analysis    │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────┐
│ Return Response │
│ + Sources       │
└─────────────────┘
```

**Vision-Capable Models**:
| Provider | Models | Image Format |
|----------|--------|--------------|
| OpenAI | gpt-4.1, gpt-4.1-mini, gpt-4.1-nano | Base64 data URL |
| Google | gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite | Base64 (auto-converted by LiteLLM) |
| Mistral | mistral-large-3, mistral-small-3.2 | Base64 data URL |

**Implementation**: Images are passed as `ImageContent` objects with base64 encoding, MIME type, and filename. The `generateResponseWithTools()` function builds multimodal content parts when images are present.

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
- User-uploaded content (files, web pages, YouTube) attached to threads
- Deleting a thread removes all associated data

#### Thread Upload Options

Users can add content to threads via three methods:

| Method | Description | Requirements |
|--------|-------------|--------------|
| **File Upload** | PDF, TXT, PNG, JPG, JPEG, WebP (max 10MB) | None |
| **Web URL** | Extract text content from web pages | Tavily API key |
| **YouTube** | Extract video transcripts | Supadata API key |

```
User clicks 📎 Attachment button
    │
    ├── File Tab ──────▶ Upload local files (drag & drop or browse)
    │
    ├── Web URL Tab ───▶ Enter URL ──▶ Tavily extracts content
    │
    └── YouTube Tab ───▶ Enter URL ──▶ Supadata extracts transcript
    │
    ▼
Queue items ──▶ Upload All ──▶ Save to thread folder
    │
    ▼
Artifacts Panel updates with new items
```

### 5. Data Tools

Policy Bot includes tools for querying external data sources and executing dynamic functions:

#### Data Sources
- **API Data Sources**: Connect to external REST APIs with authentication
- **CSV Data Sources**: Upload and query CSV files with automatic column inference
- **Category-Based Access**: Data sources linked to categories for access control
- **Server-Side Aggregation**: Group, count, sum, avg operations for large datasets
- **Auto-Visualization**: Automatic chart type selection based on data patterns

```
User Query
    │
    ▼
┌─────────────────┐
│ LLM decides to  │
│ call data_source│
│ tool            │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Fetch from API  │──── or ────┐
│ or CSV source   │            │
└─────────────────┘            │
    │                          │
    ▼                          ▼
┌─────────────────┐    ┌─────────────────┐
│ Apply filters,  │    │ Return cached   │
│ aggregations    │    │ response        │
└─────────────────┘    └─────────────────┘
    │
    ▼
┌─────────────────┐
│ Return data +   │
│ visualization   │
│ hints           │
└─────────────────┘
```

#### Function APIs
- **Dynamic Functions**: Admin-configured API endpoints with OpenAI-format schemas
- **Automatic Injection**: Functions added to LLM tools based on category context
- **Flexible Operations**: Support GET, POST, PUT, DELETE methods
- **Use Cases**: Submit feedback, retrieve analytics, trigger workflows

#### Tool Routing
- **Keyword/Regex Patterns**: Match user messages to force specific tools
- **Force Modes**: `required` (force specific tool), `preferred` (force tool use), `suggested` (hint)
- **Category Scoping**: Rules can apply globally or to specific categories
- **Priority System**: Lower priority values are evaluated first

```
User Message
    │
    ▼
┌─────────────────┐
│ Match against   │
│ routing rules   │
└─────────────────┘
    │
    ├── No Match ──────────────▶ tool_choice = 'auto'
    │
    ├── Single Required ───────▶ tool_choice = {function: {name: '...'}}
    │
    ├── Multiple Required ─────▶ tool_choice = 'required' (LLM picks one)
    │
    └── Preferred/Suggested ───▶ tool_choice = 'required' or 'auto'
```

### 6. Artifacts Panel

The Artifacts Panel is a collapsible right sidebar that displays all content associated with a thread:

```
┌──────────────────────────────────────────────────────────────────────┐
│                           ARTIFACTS PANEL                             │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  📎 Artifacts (count)                              [Collapse]  │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │  ▼ AI Generated (purple)                                       │  │
│  │    - Generated documents (PDF, DOCX)                           │  │
│  │    - Generated images                                          │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │  ▼ User Uploads (blue)                                         │  │
│  │    - PDF, TXT, PNG, JPG, JPEG, WebP files                      │  │
│  │    - Removable via ✕ button                                    │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │  ▼ Web Sources (green)                                         │  │
│  │    - Extracted web page content via Tavily                     │  │
│  │    - Shows title and URL                                       │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │  ▼ YouTube (red)                                               │  │
│  │    - Extracted video transcripts via Supadata                  │  │
│  │    - Shows video title and URL                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Collapsible Sections**: Each category can be expanded/collapsed
- **Persist State**: Panel collapse state saved to localStorage
- **Remove Items**: Users can remove uploads and URL sources
- **Download Links**: AI-generated content is downloadable
- **Count Badges**: Shows total items per section

**Implementation**: `src/components/chat/ArtifactsPanel.tsx`

### 7. Thread Sharing

Thread sharing allows users to share conversations via secure, expiring links:

```
User clicks Share button
    │
    ▼
┌─────────────────┐
│ Open Share      │
│ Modal           │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Configure       │──── • Expiry (1/7/30/90 days or never)
│ Share Options   │     • Allow downloads (on/off)
│                 │     • Email notification (optional)
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Generate Token  │──── Cryptographically secure 256-bit token
│ (base64url)     │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Store in DB     │──── thread_shares table
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Return URL      │──── /shared/{token}
└─────────────────┘
```

**Share Features:**
| Feature | Description |
|---------|-------------|
| **Secure Tokens** | 256-bit cryptographic tokens (base64url) |
| **Configurable Expiry** | 1, 7, 30, 90 days or never expires |
| **Download Control** | Enable/disable file downloads per share |
| **Email Notification** | Optional SendGrid integration |
| **Access Logging** | Track views and downloads |
| **Revocation** | Shares can be revoked at any time |
| **Authentication Required** | Recipients must sign in to view |

**Implementation**: `src/lib/db/sharing.ts`, `src/components/sharing/ShareModal.tsx`

### 8. User Memory System

The memory system extracts and persists key facts about users across conversations:

```
Conversation ends
    │
    ▼
┌─────────────────┐
│ Check if memory │──── Memory extraction enabled?
│ enabled         │
└─────────────────┘
    │ Yes
    ▼
┌─────────────────┐
│ Get existing    │──── Load from user_memories table
│ facts           │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ LLM extracts    │──── Analyze conversation for:
│ new facts       │     • User's role/department
│                 │     • Projects they work on
│                 │     • Response preferences
│                 │     • Frequent topics
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Merge & dedupe  │──── Limit to max facts (default 10)
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Store in DB     │──── Per user, optionally per category
└─────────────────┘
```

**Memory Features:**
- **Per-Category Context**: Facts can be stored globally or per category
- **Automatic Extraction**: LLM-based extraction at configurable intervals
- **Context Injection**: Facts injected into prompts for personalization
- **User Access**: Users can view/edit their memory via "Your Memory" sidebar
- **Admin Control**: Enable/disable via Admin > Settings > Memory

**Implementation**: `src/lib/memory.ts`

### 9. Thread Summarization

Automatic conversation compression to reduce token usage:

```
Check before chat
    │
    ▼
┌─────────────────┐
│ Count thread    │──── Compare to threshold (default 20)
│ messages        │
└─────────────────┘
    │ Above threshold
    ▼
┌─────────────────┐
│ Estimate tokens │──── Character-based heuristics
└─────────────────┘
    │ Above token limit
    ▼
┌─────────────────┐
│ LLM summarizes  │──── Preserves: questions, answers,
│ old messages    │     decisions, action items, sources
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Archive         │──── Move messages to archived_messages
│ messages        │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Store summary   │──── thread_summaries table
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Inject summary  │──── Summary replaces archived messages
│ into context    │     in future prompts
└─────────────────┘
```

**Summarization Settings:**
| Setting | Default | Description |
|---------|---------|-------------|
| enabled | false | Master switch |
| messageThreshold | 20 | Messages before summarization triggers |
| maxTokens | 8000 | Token limit before summarization |
| keepRecentMessages | 5 | Messages to keep unsummarized |
| model | (inherit) | LLM for summarization |

**Implementation**: `src/lib/summarization.ts`

### 10. Skills System

Modular prompt injection system for contextual behavior modification:

```
User sends message
    │
    ▼
┌─────────────────┐
│ Resolve active  │
│ skills          │
└─────────────────┘
    │
    ├── "Always" skills ───────────▶ Core behavior (citations, etc.)
    │
    ├── "Category" skills ─────────▶ Match thread categories
    │
    └── "Keyword" skills ──────────▶ Match message patterns
    │
    ▼
┌─────────────────┐
│ Sort by         │──── Lower priority = higher precedence
│ priority        │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Combine prompts │──── Respect max token limit
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Inject into     │──── After system prompt
│ context         │
└─────────────────┘
```

**Skill Types:**
| Type | Trigger | Example Use Case |
|------|---------|------------------|
| **Always** | Every message | Core behavior, citation formatting |
| **Category** | Thread category | HR-specific tone, Finance compliance |
| **Keyword** | Regex/keyword match | Legal disclaimer on "contract" topics |

**Skill Properties:**
- **priority**: Lower values processed first (0-100)
- **is_core**: Protected skills can't be deleted
- **is_index**: Used for RAG index optimization
- **category_restricted**: Only applies to linked categories
- **token_estimate**: Budget tracking for prompt size

**Implementation**: `src/lib/skills/`, `src/lib/db/skills.ts`

### 11. Welcome Screen

Role-based onboarding shown when no thread is selected:

```
User lands on chat (no thread selected)
    │
    ▼
┌─────────────────┐
│ Check user role │
└─────────────────┘
    │
    ├── User ──────────▶ Base cards + "Your Memory"
    │
    ├── Superuser ─────▶ Base cards + "Manage Your Categories"
    │
    └── Admin ─────────▶ Base cards + "Admin Dashboard"
    │
    ▼
Display welcome message + topic cards
```

**Welcome Screen Cards:**
| Card | Description | All Roles |
|------|-------------|-----------|
| Start Conversation | Create new thread with category selection | ✓ |
| Continue Threads | Resume previous conversations | ✓ |
| Chat Features | Upload PDFs, voice input, web URLs | ✓ |
| Artifacts Panel | View uploads and AI-generated content | ✓ |
| Your Memory | Access stored user facts | ✓ |
| Manage Categories | SuperUser dashboard access | SuperUser |
| Admin Dashboard | Full system control | Admin |

**Implementation**: `src/components/chat/WelcomeScreen.tsx`

### 12. Authentication Flow

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

### 9. Secure Thread Sharing
- **Cryptographic Tokens**: 256-bit secure tokens (base64url encoding)
- **Configurable Expiry**: Shares can be time-limited or permanent
- **Authentication Required**: Recipients must sign in to view shared threads
- **Access Logging**: All views and downloads are tracked for auditing
- **Revocation Support**: Shares can be instantly revoked by the owner
- **Rationale**: Enables collaboration while maintaining security and audit trails

### 10. User Memory Persistence
- **Per-Category Context**: Facts stored per category or globally
- **LLM-Based Extraction**: Automatic extraction using configured models
- **User Control**: Users can view and edit their stored facts
- **Rationale**: Improves personalization without requiring users to repeat context

### 11. Conversation Summarization
- **Token Cost Reduction**: Compresses long conversations to reduce API costs
- **Context Preservation**: Maintains key decisions, questions, and sources
- **Archived Message Storage**: Original messages preserved for audit
- **Rationale**: Enables long-running conversations without token limits

### 12. Modular Skills System
- **Trigger-Based Activation**: Always, category, or keyword-based
- **Priority Ordering**: Fine-grained control over skill precedence
- **Token Budgeting**: Track and limit total prompt size
- **Rationale**: Allows customization of bot behavior without code changes

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

### Thread Sharing Security
- 256-bit cryptographically secure share tokens
- Configurable expiration (1-90 days or never)
- Authentication required to access shared content
- Access logging for audit trails
- Instant revocation capability

### Input Validation
- File type validation (PDF, DOCX, XLSX, PPTX, images)
- File size limits enforced server-side (50MB admin, 10MB thread uploads)
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
