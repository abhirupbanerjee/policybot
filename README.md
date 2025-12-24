# Policy Bot

A Retrieval-Augmented Generation (RAG) chatbot that helps government staff query policy documents grouped by categories (HR, Finance, Procurement, Operations, etc) and check document compliance. Built with Next.js, ChromaDB, SQLite, and multi-provider LLM support via LiteLLM (OpenAI, Mistral, Gemini, Ollama).

## Why Policy Bot?

Policy Bot is an **enterprise AI assistant platform** designed for organizations that need intelligent access to their policy documents and data, with full control over privacy, costs, and customization.

### Core Concepts

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                               POLICY BOT PLATFORM                                     │
├───────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              USER INPUT LAYER                                    │ │
│  │    ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────────────┐ │ │
│  │    │    TEXT     │    │    VOICE    │    │           THREAD CONTEXT            │ │ │
│  │    │   (Chat)    │    │  (Whisper)  │    │  Conversations stored locally in    │ │ │
│  │    └──────┬──────┘    └──────┬──────┘    │  SQLite with file-based messages    │ │ │
│  │           └─────────┬────────┘           └─────────────────────────────────────┘ │ │
│  └─────────────────────┼────────────────────────────────────────────────────────────┘ │
│                        ▼                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                        │
│  │   CATEGORIES    │  │     SKILLS      │  │      TOOLS      │                        │
│  │   (Departments) │  │   (Behaviors)   │  │   (Capabilities)│                        │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤                        │
│  │ • HR Policies   │  │ • Always-on     │  │ • Web Search    │                        │
│  │ • Finance       │  │ • Category-     │  │ • Data Sources  │                        │
│  │ • Procurement   │  │   triggered     │  │ • Function APIs │                        │
│  │ • Operations    │  │ • Keyword-      │  │ • Document RAG  │                        │
│  │ • IT            │  │   triggered     │  │ • Chart Gen     │                        │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                        │
│           └────────────────────┼────────────────────┘                                 │
│                                ▼                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│  │                          MULTI-PROVIDER RAG PIPELINE                             │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │ │
│  │  │  INGESTION  │  │  EMBEDDING  │  │  RERANKING  │  │      LLM ENGINE         │  │ │
│  │  │ Office, PDF │  │ OpenAI or   │  │ Cohere API  │  │ OpenAI │ Mistral        │  │ │
│  │  │ Images, TXT │→ │ Local Model │→ │ or Local    │→ │ Gemini │ Ollama         │  │ │
│  │  │ Azure DI /  |  |  (3072 dim) |  | MiniLM-L6   |  │                         |  | |
|  |  | Mistral OCR │  │             |  |             |  |     (LiteLLM)           │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                              │
│           ┌────────────────────────────┼────────────────────────────┐                 │
│           ▼                            ▼                            ▼                 │
│  ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐        │
│  │     MEMORY      │          │  SUMMARIZATION  │          │     USERS       │        │
│  │ (Per-User Facts)│          │ (Long Threads)  │          │   (3-Tier ACL)  │        │
│  └─────────────────┘          └─────────────────┘          └─────────────────┘        │
│                                                                                       │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│  │                           LOCAL DATA STORAGE                                     │ │
│  │    SQLite (metadata) │ ChromaDB (vectors) │ Redis (cache) │ Filesystem (files)   │ │
│  └──────────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

### Platform Capabilities

| Capability | Description |
|------------|-------------|
| **Multi-Provider LLM** | Switch between OpenAI, Mistral, Gemini, or run locally with Ollama—no vendor lock-in |
| **Text & Voice Input** | Interact via chat or voice recording (Whisper transcription) |
| **Category-Based Organization** | Organize documents and users by department (HR, Finance, IT, etc.) |
| **Three-Tier Access Control** | Admin → SuperUser → User hierarchy with category-based permissions |
| **Skills System** | Inject custom behaviors based on category context or keyword triggers |
| **Tool Integrations** | Web search, external API queries, CSV data lookups, chart generation, task planning, YouTube transcripts, OpenAI-style function calling, keyword-based tool routing |
| **User Memory** | Extract and recall user-specific facts across conversations |
| **Thread Summarization** | Automatically summarize long conversations to maintain context |
| **Local Data Sovereignty** | All data stored locally—SQLite, ChromaDB, filesystem—with full backup control |
| **Cost Optimization** | Shared infrastructure reduces per-user AI costs compared to individual subscriptions |

### Key Differentiators

1. **No Vendor Lock-In**: Seamlessly switch between cloud providers (OpenAI, Mistral, Gemini) or run fully local with Ollama
2. **Department Isolation**: Category-based access ensures users only see relevant policies and data
3. **Intelligent Context**: Skills inject domain-specific prompts; Memory recalls user preferences
4. **Data Privacy**: Everything runs on your infrastructure—no data leaves your environment
5. **Extensible Tools**: Connect to internal APIs, databases, and external services via configurable tools

## Features

### Chat & Query
- **Natural Language Q&A** - Ask questions about policy documents in plain English
- **Web Search Integration** - Automatic web search via Tavily API when needed
- **Source Citations** - Every response includes document names, page numbers, and relevance scores
- **Conversation Threads** - Organize discussions into separate threads with category-based context
- **Multi-Turn Context** - Maintains conversation history for follow-up questions
- **Voice Input** - Record audio questions using OpenAI Whisper transcription

### Document Management
- **Category-Based Organization** - Documents organized into categories for targeted access
- **Global Documents** - Admin-managed documents available across all categories
- **File Upload** - Upload PDF, DOCX, XLSX, PPTX, and image files (up to 50MB)
- **Text Content Upload** - Paste text directly without creating a file first (bypasses OCR)
- **User Uploads** - Upload up to 3 PDFs per thread (max 5MB each) for compliance checking
- **Automatic Processing** - Documents are chunked, embedded, and indexed automatically
- **Compliance Checking** - Compare user documents against organizational policies

### Category System
- **Document Categories** - Organize policy documents by department, topic, or function
- **Category-Specific RAG** - Threads query only relevant category collections
- **Global Documents** - Mark documents as global to include in all category searches
- **Subscription Model** - Users subscribe to categories to access their documents

### Administration
- **Admin Dashboard** - Comprehensive UI with 5 tabs: Dashboard, Documents, Categories, Users, Settings
- **Dashboard Statistics** - Real-time system overview with database, ChromaDB, and storage metrics
- **Document Registry** - Monitor processing status and manage document categories
- **Category Management** - Create, edit, and delete document categories
- **User Subscriptions** - Assign default category subscriptions when creating users
- **Super User Management** - Assign categories to super users for delegated management
- **Web Search Configuration** - Enable/disable and configure Tavily web search settings
- **Reranker Configuration** - Optional chunk reranking via Cohere API or local Transformers.js
- **Multi-Provider LLM Settings** - Switch between OpenAI, Mistral, and Ollama models via LiteLLM
- **Model Presets** - Quick-select from 8 pre-configured model+RAG combinations
- **Provider Status Dashboard** - Real-time status of LLM providers and services
- **RAG Configuration** - Configure chunk sizes, similarity thresholds, and caching
- **Acronym Mappings** - Configure query expansion for common abbreviations
- **Custom Branding** - Configure bot name and icon in admin settings

### Security & Access Control
- **Multi-Provider Auth** - Azure AD and Google OAuth support
- **Three-Tier Roles** - Admin, Super User, and User roles with different permissions
- **Category-Based Access** - Users only see documents from their subscribed categories
- **Thread Isolation** - Users can only access their own conversations and uploads
- **Non-Root Containers** - Secure Docker deployment

### User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage all users, categories, documents, and settings |
| **Super User** | Manage users and upload documents to assigned categories |
| **User** | Access chat and documents from subscribed categories |

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Traefik (Reverse Proxy)                      │
│                    TLS Termination + Routing                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js Application                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   React UI  │  │  API Routes │  │   RAG Pipeline          │  │
│  │  (Frontend) │  │  (Backend)  │  │  Query → Search → LLM   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└───────┬─────────────────┬─────────────────┬─────────────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│    SQLite     │ │   ChromaDB    │ │     Redis     │ │ LiteLLM Proxy │
│     Data      │ │ Vector Search │ │ Query Cache   │ │  (Port 4000)  │
└───────────────┘ └───────────────┘ └───────────────┘ └───────┬───────┘
                                                              │
                          ┌───────────────────────────────────┼───────────────────────────────────┐
                          │                                   │                                   │
                          ▼                                   ▼                                   ▼
                  ┌───────────────┐                   ┌───────────────┐                   ┌───────────────┐
                  │   OpenAI API  │                   │  Mistral AI   │                   │    Ollama     │ 
                  └───────────────┘                   └───────────────┘                   └───────────────┘
```

### RAG Pipeline Flow
1. **Query** - User submits question via chat or voice
2. **Category Context** - Thread's subscribed categories determine search scope
3. **Cache Check** - Redis checks for cached response (configurable TTL)
4. **Embedding** - Query converted to vector using `text-embedding-3-large` (3072 dimensions)
5. **Search** - ChromaDB performs semantic search across category-specific collections
6. **Reranking** (optional) - Cohere or local model re-scores chunks by query relevance
7. **Context Building** - Top results combined with conversation history
8. **Generation** - LLM generates response via LiteLLM proxy with function calling
9. **Web Search** (if needed) - LLM automatically triggers Tavily web search for current information
10. **Combined Response** - Merges policy documents and web sources with [WEB] tags
11. **Cache & Return** - Response cached and returned with source metadata

## Infrastructure

### Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **app** | Node.js 20-alpine | 3000 | Next.js application |
| **traefik** | Traefik v3.0 | 443, 80 | Reverse proxy + TLS |
| **chroma** | chromadb/chroma | 8000 | Vector database |
| **redis** | Redis 7-alpine | 6379 | Cache + sessions |
| **litellm** | ghcr.io/berriai/litellm | 4000 | Multi-provider LLM gateway |

### Volumes
- `app_data` - SQLite database, thread data, user uploads, global documents
- `chroma_data` - Vector embeddings (category-based collections)
- `redis_data` - Cache persistence
- `letsencrypt` - SSL certificates

### Resource Requirements

| Resource | Development | Small (1-10 users) | Medium (11-50 users) | Large (51+ users) |
|----------|-------------|--------------------|-----------------------|-------------------|
| CPU | 2 cores | 4 cores | 8 cores | 16+ cores |
| RAM | 4 GB | 8 GB | 16 GB | 32+ GB |
| Disk | 20 GB | 50 GB | 100 GB | 200+ GB |
| Database | SQLite | SQLite | PostgreSQL | PostgreSQL + PgBouncer |

**Scaling Notes:**
- **Development**: Single-user local development with SQLite
- **Small**: SQLite works well for small teams; consider PostgreSQL for better concurrency
- **Medium**: Migrate to PostgreSQL for improved write concurrency and backup options
- **Large**: Add PgBouncer for connection pooling; consider read replicas for heavy query loads

## Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - UI components
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

### Backend
- **Next.js API Routes** - RESTful endpoints
- **TypeScript** - Type safety
- **better-sqlite3** - SQLite database driver

### AI/ML - LLM Providers (via LiteLLM)
- **OpenAI** - GPT-4.1, GPT-4.1-mini, GPT-4.1-nano
- **Mistral AI** - mistral-large-3, mistral-small-3.2, ministral-8b
- **Ollama** - llama3.2, qwen2.5 (local, no API cost)
- **OpenAI text-embedding-3-large** - Vector embeddings (3072 dimensions)
- **OpenAI Whisper** - Voice transcription
- **Azure Document Intelligence** - Primary OCR for PDF/image extraction
- **Mistral OCR** - Fallback PDF text extraction
- **Tavily API** - Real-time web search (optional, configurable via admin panel)
- **Cohere Reranker** - Chunk reranking for improved RAG relevance (optional)
- **Local Reranker** - Transformers.js with Xenova/all-MiniLM-L6-v2 (no API cost)

### Data Storage
- **SQLite** - Users, categories, documents, subscriptions, and configuration
- **ChromaDB** - Vector database with category-based collections
- **Redis 7** - Query caching and sessions
- **Filesystem** - Thread messages and uploaded files

### Infrastructure
- **Docker Compose** - Container orchestration
- **LiteLLM Proxy** - Multi-provider LLM gateway (OpenAI-compatible API)
- **Traefik v3.0** - Reverse proxy with automatic Let's Encrypt TLS

### Authentication
- **NextAuth.js** - Authentication framework
- **Azure AD** - Enterprise SSO provider
- **Google OAuth** - Consumer authentication option

## Getting Started

### Prerequisites
- Docker and Docker Compose
- OpenAI API key
- Azure AD and/or Google OAuth credentials (for production auth)

### Development Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd policy-bot
```

2. Copy environment file:
```bash
cp .env.example .env.local
```

3. Configure environment variables (see `.env.example` for full list):
```env
# [REQUIRED] Core Configuration
OPENAI_API_KEY=sk-...
ADMIN_EMAILS=admin@example.com
AUTH_DISABLED=true  # Development only

# [REQUIRED] Infrastructure
CHROMA_HOST=localhost
CHROMA_PORT=8000
REDIS_URL=redis://localhost:6379
DATA_DIR=./data

# [OPTIONAL] LiteLLM Proxy (for multi-provider support)
OPENAI_BASE_URL=http://localhost:4000/v1
LITELLM_MASTER_KEY=sk-litellm-master-change-this

# [OPTIONAL] Additional Providers
MISTRAL_API_KEY=your-mistral-api-key
OLLAMA_API_BASE=http://localhost:11434

# [OPTIONAL] Document Processing
AZURE_DI_ENDPOINT=https://...
AZURE_DI_KEY=...

# [OPTIONAL] RAG Enhancements
COHERE_API_KEY=your-cohere-api-key  # Reranking
TAVILY_API_KEY=your-tavily-api-key  # Web search

# [HAS DEFAULT] Embeddings
EMBEDDING_MODEL=text-embedding-3-large
```

4. Start development services:
```bash
docker compose -f docker-compose.dev.yml up -d
npm install
npm run dev
```

5. Open http://localhost:3000

### Production Deployment

1. Configure production environment (see `.env.example` for full list):
```env
# [REQUIRED] Core
OPENAI_API_KEY=sk-...
ADMIN_EMAILS=admin@example.com
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>

# [REQUIRED] Infrastructure
CHROMA_HOST=chroma
CHROMA_PORT=8000
REDIS_URL=redis://redis:6379
DATA_DIR=/app/data

# [REQUIRED] Authentication (at least one provider)
NEXTAUTH_URL=https://policybot.example.com
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=...
# Or Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# [REQUIRED] Deployment
DOMAIN=policybot.example.com
ACME_EMAIL=admin@example.com

# [OPTIONAL] LiteLLM Proxy (multi-provider)
OPENAI_BASE_URL=http://litellm:4000/v1
LITELLM_MASTER_KEY=sk-litellm-master-change-this

# [OPTIONAL] Additional Providers
MISTRAL_API_KEY=your-mistral-api-key

# [OPTIONAL] Document Processing
AZURE_DI_ENDPOINT=https://...
AZURE_DI_KEY=...

# [OPTIONAL] RAG Enhancements
COHERE_API_KEY=your-cohere-api-key  # Reranking
TAVILY_API_KEY=your-tavily-api-key  # Web search

# [HAS DEFAULT] Access Control
ACCESS_MODE=allowlist
```

2. Deploy with Docker Compose:
```bash
docker compose up -d --build
```

### Azure Deployment

For Azure Container Apps deployment, see:
- `docker-compose.azure.yml` - Reference configuration
- `.env.azure.example` - Azure-specific environment template

Redis TLS is supported automatically when using `rediss://` URLs.

## Project Structure

```
policy-bot/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API endpoints
│   │   │   ├── chat/           # RAG chat endpoint
│   │   │   ├── threads/        # Thread management
│   │   │   ├── transcribe/     # Voice transcription
│   │   │   ├── admin/          # Admin endpoints
│   │   │   │   ├── categories/ # Category management
│   │   │   │   ├── documents/  # Document management
│   │   │   │   ├── users/      # User management
│   │   │   │   └── super-users/# Super user management
│   │   │   ├── superuser/      # Super user endpoints
│   │   │   └── user/           # User-specific endpoints
│   │   ├── admin/              # Admin dashboard
│   │   ├── superuser/          # Super user dashboard
│   │   └── page.tsx            # Main chat interface
│   ├── components/             # React components
│   │   ├── chat/               # Chat UI components
│   │   ├── layout/             # Layout components
│   │   └── ui/                 # Shared UI components
│   ├── lib/                    # Core utilities
│   │   ├── db/                 # SQLite database layer
│   │   │   ├── index.ts        # Database connection & schema
│   │   │   ├── users.ts        # User & subscription operations
│   │   │   ├── categories.ts   # Category operations
│   │   │   ├── documents.ts    # Document metadata operations
│   │   │   └── config.ts       # Settings operations
│   │   ├── rag.ts              # RAG pipeline with web search
│   │   ├── tools.ts            # Generic tool framework
│   │   ├── tools/
│   │   │   ├── tavily.ts       # Tavily web search tool
│   │   │   ├── chart-gen.ts    # Chart generator tool
│   │   │   ├── data-source.ts  # Data source query tool
│   │   │   ├── task-planner.ts # Task planner for multi-step workflows
│   │   │   └── youtube.ts      # YouTube transcript extraction
│   │   ├── chroma.ts           # ChromaDB client (category collections)
│   │   ├── redis.ts            # Redis client (RAG + Tavily cache)
│   │   ├── openai.ts           # OpenAI integration
│   │   ├── mistral-ocr.ts      # Mistral OCR integration
│   │   ├── ingest.ts           # Document ingestion (with categories)
│   │   ├── storage.ts          # File system operations
│   │   ├── threads.ts          # Thread operations
│   │   ├── users.ts            # User management wrapper
│   │   ├── auth.ts             # Authentication helpers
│   │   └── auth-options.ts     # NextAuth configuration
│   └── types/                  # TypeScript definitions
├── docs/                       # Documentation
├── docker-compose.yml          # Production stack
├── docker-compose.dev.yml      # Development stack
├── docker-compose.azure.yml    # Azure reference config
└── Dockerfile                  # Multi-stage build
```

## API Endpoints

### Chat & Threads
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message, receive RAG response |
| POST | `/api/transcribe` | Convert audio to text |
| GET | `/api/threads` | List user threads |
| POST | `/api/threads` | Create new thread (with category IDs) |
| GET | `/api/threads/{id}` | Get thread with messages |
| DELETE | `/api/threads/{id}` | Delete thread |
| POST | `/api/threads/{id}/upload` | Upload PDF to thread |

### Admin - Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/documents` | List all documents with categories |
| POST | `/api/admin/documents` | Upload file (with category IDs, isGlobal) |
| POST | `/api/admin/documents/text` | Upload text content (bypasses OCR) |
| GET | `/api/admin/documents/{id}` | Get document details |
| DELETE | `/api/admin/documents/{id}` | Delete document |
| PUT | `/api/admin/documents/{id}` | Reindex document |
| PATCH | `/api/admin/documents/{id}` | Update categories/global status |

### Admin - Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/categories` | List all categories with stats |
| POST | `/api/admin/categories` | Create new category |
| GET | `/api/admin/categories/{id}` | Get category details |
| PUT | `/api/admin/categories/{id}` | Update category |
| DELETE | `/api/admin/categories/{id}` | Delete category |

### Admin - Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users with subscriptions |
| POST | `/api/admin/users` | Add user (with subscriptions/assignments) |
| DELETE | `/api/admin/users?email=...` | Remove user |
| PATCH | `/api/admin/users` | Update user role |
| GET | `/api/admin/users/{id}/subscriptions` | Get user subscriptions |
| POST | `/api/admin/users/{id}/subscriptions` | Add subscription |
| PUT | `/api/admin/users/{id}/subscriptions` | Toggle subscription active |
| DELETE | `/api/admin/users/{id}/subscriptions` | Remove subscription |

### Admin - Super Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/super-users` | List super users with assignments |
| POST | `/api/admin/super-users/{id}/categories` | Assign category to super user |
| DELETE | `/api/admin/super-users/{id}/categories` | Remove category assignment |

### Super User
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/superuser/documents` | Get documents in assigned categories |
| POST | `/api/superuser/documents` | Upload file to assigned category |
| POST | `/api/superuser/documents/text` | Upload text content to assigned category |
| DELETE | `/api/superuser/documents/{id}` | Delete own document |
| GET | `/api/superuser/users` | Get users in assigned categories |
| POST | `/api/superuser/users` | Add user subscription |
| DELETE | `/api/superuser/users` | Remove user subscription |

### User
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/categories` | Get accessible categories |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/settings` | Get all settings (LLM, RAG, reranker, etc.) |
| PATCH | `/api/admin/settings` | Update settings by type |
| GET | `/api/admin/system-prompt` | Get system prompt |
| PUT | `/api/admin/system-prompt` | Update system prompt |
| POST | `/api/admin/refresh` | Re-index all documents |
| GET | `/api/admin/stats` | Get system statistics |
| GET | `/api/admin/providers` | Get LLM provider and service status |
| GET | `/api/admin/reranker-status` | Get reranker availability (Cohere/local) |

### Tool Routing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/tool-routing` | List all routing rules |
| POST | `/api/admin/tool-routing` | Create new routing rule |
| GET | `/api/admin/tool-routing/{id}` | Get routing rule by ID |
| PATCH | `/api/admin/tool-routing/{id}` | Update routing rule |
| DELETE | `/api/admin/tool-routing/{id}` | Delete routing rule |
| POST | `/api/admin/tool-routing/test` | Test routing with a message |

## Database Schema

Policy Bot uses SQLite for metadata storage with the following tables:

### Core Tables
- **users** - User accounts with roles (admin, superuser, user)
- **categories** - Document categories with slugs
- **documents** - Document metadata and processing status

### Relationship Tables
- **document_categories** - Document-to-category assignments
- **user_subscriptions** - User category subscriptions
- **super_user_categories** - Super user category assignments

### Configuration Tables
- **config** - Key-value settings storage
- **tool_configs** - Global tool configurations
- **tool_routing_rules** - Keyword/regex patterns for forcing tool calls
- **category_tool_configs** - Category-specific tool overrides and templates

### Feature Tables
- **task_plans** - Multi-step task plans for complex workflows

See [docs/DATABASE.md](docs/DATABASE.md) for complete schema details.

## Admin Configuration

### LLM Model Selection (via LiteLLM)

Policy Bot supports multiple LLM providers through LiteLLM proxy, configurable via the admin panel:

| Provider | Models | Use Case |
|----------|--------|----------|
| **OpenAI** | GPT-4.1, GPT-4.1-mini, GPT-4.1-nano | Production workloads |
| **Mistral** | mistral-large-3, mistral-small-3.2, ministral-8b | Alternative provider |
| **Ollama** | llama3.2, qwen2.5 | Local development, no API cost |

### Model Presets

The admin panel provides 8 pre-configured model presets that optimize both LLM and RAG settings:

| Preset | Model | Temperature | Max Tokens | Top K / Max Context |
|--------|-------|-------------|------------|---------------------|
| GPT-4.1 (High Performance) | gpt-4.1 | 0.1 | 4000 | 25/20 |
| GPT-4.1 Mini (Balanced) | gpt-4.1-mini | 0.2 | 3000 | 20/15 |
| GPT-4.1 Nano (Cost-Effective) | gpt-4.1-nano | 0.2 | 2000 | 15/10 |
| Mistral Large 3 | mistral-large-3 | 0.2 | 3000 | 20/15 |
| Mistral Small 3.2 | mistral-small-3.2 | 0.2 | 2000 | 15/10 |
| Ministral 8B | ministral-8b | 0.2 | 2000 | 10/8 |
| Ollama Llama 3.2 | ollama-llama3.2 | 0.2 | 2000 | 15/10 |
| Ollama Qwen 2.5 | ollama-qwen2.5 | 0.2 | 2000 | 15/10 |

**Default preset:** `gpt-4.1-mini` (Balanced) - temperature: 0.2, maxTokens: 2000

### Provider Status Dashboard

The admin settings page displays real-time status of:
- **LLM Providers**: OpenAI, Mistral, Ollama, Azure (connected/configured/unavailable)
- **Services**: Embeddings, Document OCR, Audio Transcription

### Embedding Configuration

Embeddings are configured via environment variables:
```env
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=3072
```

**Important:** Changing embedding dimensions requires re-indexing all documents.

### Document Text Extraction (OCR)

Policy Bot uses a multi-layer approach for extracting text from documents:

1. **Primary:** Azure Document Intelligence (if configured) - Enterprise OCR for PDFs and images
2. **Secondary:** Mistral OCR (if `MISTRAL_API_KEY` is set) - Advanced OCR with markdown support
3. **Fallback:** pdf-parse - Traditional PDF text extraction

The system automatically falls back through the chain if a service fails or is unavailable.

### RAG Configuration

Configurable via admin panel Settings > RAG Settings:

| Setting | Default | Description |
|---------|---------|-------------|
| Top K Chunks | 15 | Number of chunks to retrieve |
| Max Context Chunks | 10 | Chunks sent to LLM |
| Similarity Threshold | 0.5 | Minimum relevance score (0-1) |
| Chunk Size | 1200 | Characters per chunk |
| Chunk Overlap | 200 | Overlap between chunks |
| Query Expansion | Enabled | Expand acronyms automatically |
| Response Caching | Enabled | Cache responses in Redis |
| Cache TTL | 3600s | Cache expiration (1 hour) |

### Reranker Configuration

Optional chunk reranking for improved RAG relevance (Settings > Reranker):

| Setting | Default | Description |
|---------|---------|-------------|
| Enabled | false | Enable chunk reranking |
| Provider | cohere | `cohere` (API) or `local` (Transformers.js) |
| Top K for Reranking | 50 | Chunks to rerank before filtering |
| Min Reranker Score | 0.3 | Minimum score to include (0-1) |
| Cache TTL | 3600s | Reranker cache expiration |

**Providers:**
- **Cohere API** - Fast, requires `COHERE_API_KEY`, uses `rerank-english-v3.0`
- **Local** - No API cost, uses `Xenova/all-MiniLM-L6-v2`, slower first load

### Branding Configuration

Admins can customize the bot's appearance through the Settings tab:

| Setting | Description | Default |
|---------|-------------|---------|
| Bot Name | Display name shown in sidebar | "Policy Bot" |
| Bot Icon | Icon from preset list (government, operations, finance, etc.) | "policy" |

**Dynamic Chat Header:**
- Users with 1 category subscription see: "[Category] Assistant"
- Users with 2+ subscriptions see: "GEA Global Assistant"
- Admins/superusers see the configured bot name

## User Management

### Roles

| Role | Description |
|------|-------------|
| **admin** | Full access including user management and document administration |
| **superuser** | Can manage users subscribed to their assigned categories |
| **user** | Can use chat and upload documents to threads |

### Access Control Modes

Policy Bot supports two access control modes configured via `ACCESS_MODE` environment variable.

#### Allowlist Mode (Default)
Only users explicitly added to the allowlist can sign in.
```env
ACCESS_MODE=allowlist
```

#### Domain Mode
Any user with an email from allowed domains can sign in.
```env
ACCESS_MODE=domain
ALLOWED_DOMAINS=example.com,company.org
```

### Managing Users via API

#### Add a User with Subscriptions
```bash
curl -X POST https://your-domain.com/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "email": "user@example.com",
    "role": "user",
    "name": "John Doe",
    "subscriptions": [1, 2, 3]
  }'
```

#### Add a Super User with Assignments
```bash
curl -X POST https://your-domain.com/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "email": "manager@example.com",
    "role": "superuser",
    "name": "Jane Manager",
    "assignedCategories": [1, 2]
  }'
```

### Initial Setup

On first deployment, users from `ADMIN_EMAILS` environment variable are automatically added as admins. You can then use the admin dashboard or API to add more users.

## OAuth Provider Setup

### Azure AD

1. Go to Azure Portal > App registrations > New registration
2. Set redirect URI: `https://your-domain.com/api/auth/callback/azure-ad`
3. Create a client secret under "Certificates & secrets"
4. Copy Application (client) ID, Directory (tenant) ID, and client secret to `.env`

### Google

1. Go to Google Cloud Console > APIs & Services > Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `https://your-domain.com/api/auth/callback/google`
4. Copy Client ID and Client Secret to `.env`

## Scripts & Commands

### Development
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run lint             # Run ESLint
npm run type-check       # TypeScript type checking
npm run test:connectivity # Test API connectivity
```

### Docker Operations
```bash
npm run docker:dev       # Start development services (ChromaDB + Redis)
npm run docker:dev:down  # Stop development services
npm run docker:prod      # Build and start production stack
npm run docker:prod:down # Stop production stack
npm run docker:logs      # View application logs
```

## LiteLLM Configuration

Policy Bot uses LiteLLM as a unified gateway to multiple LLM providers. Configuration is stored in `litellm-proxy/litellm_config.yaml`:

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

### Benefits
- **Unified API**: Single OpenAI-compatible endpoint for all providers
- **Hot-Swappable Models**: Change models via admin UI without redeployment
- **Cost Optimization**: Use cheaper models for simple queries
- **Local Models**: Run Ollama models for zero API cost during development

## Documentation

**Architecture & Design:**
- [Solution Architecture](docs/SOLUTION.md) - System design, RAG pipeline, and data tools
- [Database Schema](docs/DATABASE.md) - SQLite schema, settings, and model presets
- [UI Wireframes](docs/UI_WIREFRAMES.md) - Admin dashboard and component designs

**API Reference:**
- [API Specification](docs/API_SPECIFICATION.md) - REST API reference
- [OpenAPI Specification](docs/openapi.yaml) - OpenAPI 3.0 schema

**Features & Configuration:**
- [Memory, Skills & Functions](docs/Memory-Skill-Functions.md) - Skills system, tools, data sources, and function APIs
- [Tools Reference](docs/Tools.md) - Web search, document generation, data sources, function APIs, task planner, YouTube, tool routing
- [LiteLLM Guide](docs/liteLLM-implementation-guide.md) - Multi-provider LLM configuration

**Deployment:**
- [Infrastructure Guide](docs/INFRASTRUCTURE.md) - Docker, deployment, and cost estimation
- [Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md) - Production deployment guide

## Acknowledgements

Policy Bot is built on the shoulders of excellent open-source projects:

### Core Infrastructure
- **[LiteLLM](https://github.com/BerriAI/litellm)** - Unified LLM API gateway for multi-provider support
- **[Ollama](https://github.com/ollama/ollama)** - Local LLM inference for privacy-first deployments
- **[Traefik](https://github.com/traefik/traefik)** - Cloud-native reverse proxy with automatic TLS
- **[ChromaDB](https://github.com/chroma-core/chroma)** - Open-source vector database for embeddings
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** - Fast SQLite driver for Node.js
- **[Redis](https://redis.io/)** - In-memory caching and session storage

### Reranking
- **[Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2)** - Local reranking model

### Framework & Libraries
- **[Next.js](https://nextjs.org/)** - React framework with App Router
- **[NextAuth.js](https://next-auth.js.org/)** - Authentication for Next.js

## License

MIT
