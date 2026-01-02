# Policy Bot

An enterprise RAG platform for policy document management and intelligent querying. Built with Next.js, ChromaDB, and multi-provider LLM support.

## Platform Benefits

| Benefit | Description |
|---------|-------------|
| **No Vendor Lock-In** | Switch between OpenAI, Mistral, Gemini, or run locally with Ollama |
| **Data Sovereignty** | All data stored locally (SQLite, ChromaDB, filesystem) with full backup control |
| **Department Isolation** | Category-based access ensures users only see relevant policies |
| **Cost Optimization** | Shared infrastructure reduces per-user AI costs vs individual subscriptions |
| **Extensible Tools** | Connect to internal APIs, databases, and external services |

## Capabilities

### Core Features
- **RAG-Powered Q&A** - Natural language queries with source citations
- **Multi-Provider LLM** - OpenAI, Mistral, Gemini, Ollama via LiteLLM
- **Voice Input** - Whisper transcription for audio questions
- **Streaming Responses** - Real-time chat with typing indicators

### Document Management
- **Category Organization** - Documents grouped by department (HR, Finance, IT, etc.)
- **Multi-Format Upload** - PDF, DOCX, XLSX, PPTX, images (up to 50MB)
- **Text Content Upload** - Paste text directly, bypasses OCR
- **Compliance Checking** - Compare user documents against policies

### Access Control
- **Three-Tier Roles** - Admin > SuperUser > User hierarchy
- **Category Subscriptions** - Users access only subscribed categories
- **Multi-Provider Auth** - Azure AD and Google OAuth

### AI Enhancements
- **Skills System** - Inject behaviors based on category/keyword triggers
- **User Memory** - Recall user-specific facts across conversations
- **Thread Summarization** - Compress long conversations
- **Reranking** - Cohere API or local Transformers.js

### Collaboration
- **Thread Sharing** - Share conversations via secure links with expiration
- **Email Notifications** - Optional SendGrid integration for share alerts
- **Access Control** - Authentication required to view shared content
- **Download Control** - Configurable file download permissions per share

### Tools
- **Web Search** - Tavily integration for current information
- **Data Sources** - Query external APIs and CSV files
- **Function APIs** - OpenAI-style function calling
- **Chart Generation** - Visualize data in responses
- **Task Planning** - Multi-step workflow execution
- **YouTube** - Extract and query video transcripts

## Directory Structure

```
policy-bot/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # REST API endpoints
│   │   │   ├── chat/           # RAG chat (streaming + non-streaming)
│   │   │   ├── threads/        # Thread CRUD + file uploads
│   │   │   ├── admin/          # Admin endpoints (documents, users, categories, settings)
│   │   │   ├── superuser/      # SuperUser endpoints
│   │   │   └── user/           # User endpoints
│   │   ├── admin/              # Admin dashboard UI
│   │   ├── superuser/          # SuperUser dashboard UI
│   │   └── page.tsx            # Chat interface
│   ├── components/             # React components
│   │   ├── chat/               # Chat UI (messages, input, sources)
│   │   ├── admin/              # Admin dashboard components
│   │   └── ui/                 # Shared UI components
│   ├── lib/                    # Core libraries
│   │   ├── db/                 # SQLite layer (users, categories, documents, config)
│   │   ├── tools/              # Tool implementations (web search, charts, data sources)
│   │   ├── rag.ts              # RAG pipeline
│   │   ├── chroma.ts           # ChromaDB client
│   │   ├── redis.ts            # Redis caching
│   │   ├── ingest.ts           # Document ingestion
│   │   └── skills.ts           # Skills system
│   └── types/                  # TypeScript definitions
├── docs/                       # Comprehensive documentation
│   ├── SOLUTION.md             # Architecture and design decisions
│   ├── DATABASE.md             # Complete SQLite/ChromaDB/Redis schema
│   ├── API_SPECIFICATION.md    # Full REST API reference
│   ├── Tools.md                # Tool system documentation
│   ├── UI_WIREFRAMES.md        # Interface designs
│   ├── INFRASTRUCTURE.md       # Deployment and operations
│   ├── Memory-Skill-Functions.md # Skills, memory, and function APIs
│   └── user_manuals/           # User, Admin, SuperUser guides
├── litellm-proxy/              # LiteLLM configuration
├── docker-compose.yml          # Production stack
├── docker-compose.dev.yml      # Development stack
└── Dockerfile                  # Multi-stage build
```

## Quick Start

### Development
```bash
cp .env.example .env.local
# Configure OPENAI_API_KEY, ADMIN_EMAILS

docker compose -f docker-compose.dev.yml up -d
npm install && npm run dev
```

### Production
```bash
# Configure .env with auth providers and domain
docker compose up -d --build
```

## Infrastructure

| Service | Purpose |
|---------|---------|
| **Next.js** | Application (port 3000) |
| **ChromaDB** | Vector database (port 8000) |
| **Redis** | Cache + sessions (port 6379) |
| **LiteLLM** | Multi-provider LLM gateway (port 4000) |
| **Traefik** | Reverse proxy + TLS (ports 80, 443) |

## Documentation

| Document | Content |
|----------|---------|
| [SOLUTION.md](docs/SOLUTION.md) | Architecture, RAG pipeline, design decisions |
| [DATABASE.md](docs/DATABASE.md) | SQLite schema, ChromaDB collections, Redis patterns |
| [API_SPECIFICATION.md](docs/API_SPECIFICATION.md) | Complete REST API reference |
| [Tools.md](docs/Tools.md) | Tool system: web search, data sources, charts, etc. |
| [INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) | Docker deployment, scaling, backup/restore |
| [Memory-Skill-Functions.md](docs/Memory-Skill-Functions.md) | Skills, memory extraction, function APIs |

## License

MIT
