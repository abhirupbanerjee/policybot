# Policy Bot

A Retrieval-Augmented Generation (RAG) chatbot that helps government staff query  documents grouped by categories (HR, Finance, Procurement, Operations, etc) and check document compliance. Built with Next.js, ChromaDB, SQLite, Tavily and OpenAI.

## Features

### Chat & Query
- **Natural Language Q&A** - Ask questions about policy documents in plain English
- **Web Search Integration** - Automatic web search via Tavily API when needed (see [Web Search](docs/web-search.md))
- **Source Citations** - Every response includes document names, page numbers, and relevance scores
- **Conversation Threads** - Organize discussions into separate threads with category-based context
- **Multi-Turn Context** - Maintains conversation history for follow-up questions
- **Voice Input** - Record audio questions using OpenAI Whisper transcription

### Document Management
- **Category-Based Organization** - Documents organized into categories for targeted access
- **Global Documents** - Admin-managed documents available across all categories
- **User Uploads** - Upload up to 3 PDFs per thread (max 5MB each) for compliance checking
- **Automatic Processing** - Documents are chunked, embedded, and indexed automatically
- **Compliance Checking** - Compare user documents against organizational policies

### Category System
- **Document Categories** - Organize policy documents by department, topic, or function
- **Category-Specific RAG** - Threads query only relevant category collections
- **Global Documents** - Mark documents as global to include in all category searches
- **Subscription Model** - Users subscribe to categories to access their documents

### Administration
- **Admin Dashboard** - Comprehensive UI for managing documents, users, and categories
- **Document Registry** - Monitor processing status and manage document categories
- **Category Management** - Create, edit, and delete document categories
- **User Subscriptions** - Assign default category subscriptions when creating users
- **Super User Management** - Assign categories to super users for delegated management
- **Web Search Configuration** - Enable/disable and configure Tavily web search settings
- **LLM & RAG Settings** - Configure model, temperature, chunk sizes, and caching

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
| **Super User** | Manage users subscribed to their assigned categories |
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
│    SQLite     │ │   ChromaDB    │ │     Redis     │ │   OpenAI API  │
│   Metadata    │ │ Vector Search │ │ Query Cache   │ │ GPT + Embed   │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
```

### RAG Pipeline Flow
1. **Query** - User submits question via chat or voice
2. **Category Context** - Thread's subscribed categories determine search scope
3. **Cache Check** - Redis checks for cached response (configurable TTL)
4. **Embedding** - Query converted to vector using `text-embedding-3-large` (3072 dimensions)
5. **Search** - ChromaDB performs semantic search across category-specific collections
6. **Context Building** - Top results combined with conversation history
7. **Generation** - GPT generates response with OpenAI function calling
8. **Web Search** (if needed) - LLM automatically triggers Tavily web search for current information
9. **Combined Response** - Merges policy documents and web sources with [WEB] tags
10. **Cache & Return** - Response cached and returned with source metadata

## Infrastructure

### Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **app** | Node.js 20-alpine | 3000 | Next.js application |
| **traefik** | Traefik 3.0 | 443, 80 | Reverse proxy + TLS |
| **chroma** | chromadb/chroma | 8000 | Vector database |
| **redis** | Redis 7-alpine | 6379 | Cache + sessions |

### Volumes
- `app_data` - SQLite database, thread data, user uploads, global documents
- `chroma_data` - Vector embeddings (category-based collections)
- `redis_data` - Cache persistence
- `letsencrypt` - SSL certificates

### Resource Requirements
| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Disk | 20 GB | 50 GB |

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

### AI/ML
- **OpenAI GPT-5 Mini** - Primary chat completions (configurable)
- **OpenAI GPT-5** - Advanced reasoning for complex queries
- **OpenAI GPT-4.1 Mini** - Fast, cost-effective alternative
- **OpenAI text-embedding-3-large** - Vector embeddings (3072 dimensions)
- **OpenAI Whisper** - Voice transcription
- **Mistral OCR** - Advanced PDF text extraction with markdown support (fallback to pdf-parse)
- **Tavily API** - Real-time web search for current information (optional, configurable via admin panel)

### Data Storage
- **SQLite** - Users, categories, documents, subscriptions, and configuration
- **ChromaDB** - Vector database with category-based collections
- **Redis** - Query caching and sessions
- **Filesystem** - Thread messages and uploaded files

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Traefik** - Reverse proxy with automatic Let's Encrypt TLS

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

3. Configure environment variables:
```env
# Required
OPENAI_API_KEY=sk-...
AUTH_DISABLED=true
DATA_DIR=./data

# Optional - Mistral OCR for advanced PDF extraction
MISTRAL_API_KEY=your-mistral-api-key

# Optional - Tavily Web Search (configure via admin panel after setup)
# TAVILY_API_KEY is stored in database

# Embedding configuration (defaults shown)
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=3072
```

4. Start development services:
```bash
docker compose -f docker-compose.dev.yml up -d
npm install
npm run dev
```

5. Open http://localhost:3000

### Production Deployment

1. Configure production environment:
```env
# Domain & TLS
DOMAIN=policybot.example.com
ACME_EMAIL=admin@example.com

# OpenAI
OPENAI_API_KEY=sk-...

# Mistral OCR (optional but recommended)
MISTRAL_API_KEY=your-mistral-api-key

# Embeddings (defaults to text-embedding-3-large, 3072 dimensions)
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=3072

# Authentication
NEXTAUTH_SECRET=<generate-secret>
NEXTAUTH_URL=https://policybot.example.com
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Access Control
ACCESS_MODE=allowlist
ADMIN_EMAILS=admin@example.com
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
│   │   │   └── tavily.ts       # Tavily web search tool
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
| POST | `/api/admin/documents` | Upload document (with category IDs, isGlobal) |
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
| GET | `/api/admin/settings` | Get LLM, RAG, and Tavily settings |
| PUT | `/api/admin/settings` | Update settings |
| GET | `/api/admin/system-prompt` | Get system prompt |
| POST | `/api/admin/system-prompt` | Update system prompt |
| POST | `/api/admin/refresh` | Re-index documents with current settings |
| GET | `/api/admin/stats` | Get system statistics |

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

See [docs/DATABASE.md](docs/DATABASE.md) for complete schema details.

## Admin Configuration

### LLM Model Selection

Policy Bot supports multiple OpenAI models, configurable through the admin panel:

| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| **GPT-5** | Slow (2.8s) | High | Complex reasoning, analysis |
| **GPT-5 Mini** | Fast (1.2s) | Medium | Balanced use (recommended) |
| **GPT-4.1 Mini** | Fastest (0.5s) | Low | High volume, simple queries |

**Note:** GPT-5 models use default temperature=1 and cannot be customized. GPT-4.1 Mini supports custom temperature settings.

### Embedding Configuration

Embeddings are configured via environment variables:
```env
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=3072
```

**Important:** Changing embedding dimensions requires re-indexing all documents.

### PDF Text Extraction

Policy Bot uses a dual-layer approach:
1. **Primary:** Mistral OCR (if `MISTRAL_API_KEY` is set) - Advanced OCR with markdown support
2. **Fallback:** pdf-parse - Traditional PDF text extraction

The system automatically falls back to pdf-parse if Mistral OCR fails or is unavailable.

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

## Documentation

See [docs/README.md](docs/README.md) for complete documentation index.

**Core Docs:**
- [Solution Architecture](docs/SOLUTION.md) - System design and components
- [API Specification](docs/API_SPECIFICATION.md) - REST API reference
- [Infrastructure Guide](docs/INFRASTRUCTURE.md) - Docker and deployment
- [Database Schema](docs/DATABASE.md) - SQLite schema and relationships
- [Web Search Integration](docs/web-search.md) - Tavily web search setup
- [Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md) - Production deployment guide

## License

MIT
