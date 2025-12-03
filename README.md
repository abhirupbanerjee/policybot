# Policy Bot

A Retrieval-Augmented Generation (RAG) chatbot that helps government staff query policy documents and check document compliance. Built with Next.js, ChromaDB, and OpenAI.

## Features

### Chat & Query
- **Natural Language Q&A** - Ask questions about policy documents in plain English
- **Source Citations** - Every response includes document names, page numbers, and relevance scores
- **Conversation Threads** - Organize discussions into separate threads with titles
- **Multi-Turn Context** - Maintains conversation history for follow-up questions
- **Voice Input** - Record audio questions using OpenAI Whisper transcription

### Document Management
- **User Uploads** - Upload up to 3 PDFs per thread (max 5MB each) for compliance checking
- **Global Policy Documents** - Admin-managed document library available to all users
- **Automatic Processing** - Documents are chunked, embedded, and indexed automatically
- **Compliance Checking** - Compare user documents against organizational policies

### Administration
- **Admin Panel** - Dedicated UI for managing global policy documents
- **Document Registry** - Monitor processing status (processing/ready/error)
- **Bulk Ingestion** - Upload documents up to 50MB with automatic reindexing

### Security & Access Control
- **Multi-Provider Auth** - Azure AD and Google OAuth support
- **User Allowlist** - Control exactly who can access the application
- **Role-Based Access** - Admin and user roles with different permissions
- **Thread Isolation** - Users can only access their own conversations and uploads
- **Non-Root Containers** - Secure Docker deployment

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
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│   ChromaDB    │ │     Redis     │ │   OpenAI API  │
│ Vector Search │ │ Query Cache   │ │ GPT + Embed   │
└───────────────┘ └───────────────┘ └───────────────┘
```

### RAG Pipeline Flow
1. **Query** - User submits question via chat or voice
2. **Cache Check** - Redis checks for cached response (1-hour TTL)
3. **Embedding** - Query converted to vector using `text-embedding-3-large` (3072 dimensions)
4. **Search** - ChromaDB performs semantic search across policy documents
5. **Context Building** - Top results combined with conversation history
6. **Generation** - GPT-5 Mini generates response with citations (configurable via admin panel)
7. **Cache & Return** - Response cached and returned with source metadata

## Infrastructure

### Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **app** | Node.js 20-alpine | 3000 | Next.js application |
| **traefik** | Traefik 3.0 | 443, 80 | Reverse proxy + TLS |
| **chroma** | chromadb/chroma | 8000 | Vector database |
| **redis** | Redis 7-alpine | 6379 | Cache + sessions |

### Volumes
- `app_data` - Thread data, user uploads, global documents
- `chroma_data` - Vector embeddings
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

### AI/ML
- **OpenAI GPT-5 Mini** - Primary chat completions (configurable)
- **OpenAI GPT-5** - Advanced reasoning for complex queries
- **OpenAI GPT-4.1 Mini** - Fast, cost-effective alternative
- **OpenAI text-embedding-3-large** - Vector embeddings (3072 dimensions)
- **OpenAI Whisper** - Voice transcription
- **Mistral OCR** - Advanced PDF text extraction with markdown support (fallback to pdf-parse)

### Data Storage
- **ChromaDB** - Vector database for semantic search
- **Redis** - Query caching and sessions
- **Filesystem** - JSON-based thread and document storage

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

## Project Structure

```
policy-bot/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API endpoints
│   │   │   ├── chat/           # RAG chat endpoint
│   │   │   ├── threads/        # Thread management
│   │   │   ├── transcribe/     # Voice transcription
│   │   │   └── admin/          # Admin endpoints
│   │   ├── admin/              # Admin dashboard
│   │   └── page.tsx            # Main chat interface
│   ├── components/             # React components
│   │   ├── chat/               # Chat UI components
│   │   ├── layout/             # Layout components
│   │   └── ui/                 # Shared UI components
│   ├── lib/                    # Core utilities
│   │   ├── rag.ts              # RAG pipeline
│   │   ├── chroma.ts           # ChromaDB client
│   │   ├── redis.ts            # Redis client
│   │   ├── openai.ts           # OpenAI integration (GPT-5 support)
│   │   ├── mistral-ocr.ts      # Mistral OCR integration
│   │   ├── ingest.ts           # Document ingestion (with OCR)
│   │   ├── storage.ts          # File system and settings
│   │   ├── threads.ts          # Thread operations
│   │   ├── users.ts            # User management
│   │   ├── auth.ts             # Authentication helpers
│   │   └── auth-options.ts     # NextAuth configuration
│   └── types/                  # TypeScript definitions
├── docs/                       # Documentation
├── docker-compose.yml          # Production stack
├── docker-compose.dev.yml      # Development stack
└── Dockerfile                  # Multi-stage build
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message, receive RAG response |
| POST | `/api/transcribe` | Convert audio to text |
| GET | `/api/threads` | List user threads |
| POST | `/api/threads` | Create new thread |
| GET | `/api/threads/{id}` | Get thread with messages |
| DELETE | `/api/threads/{id}` | Delete thread |
| POST | `/api/threads/{id}/upload` | Upload PDF to thread |
| GET | `/api/admin/documents` | List global documents |
| POST | `/api/admin/documents` | Upload global document |
| DELETE | `/api/admin/documents/{id}` | Delete global document |
| GET | `/api/admin/users` | List allowed users |
| POST | `/api/admin/users` | Add user to allowlist |
| DELETE | `/api/admin/users?email=...` | Remove user from allowlist |
| PATCH | `/api/admin/users` | Update user role |
| GET | `/api/admin/settings` | Get LLM and RAG settings |
| POST | `/api/admin/settings` | Update LLM model, temperature, RAG parameters |
| GET | `/api/admin/system-prompt` | Get system prompt |
| POST | `/api/admin/system-prompt` | Update system prompt |
| POST | `/api/admin/refresh` | Re-index document with current settings |

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

Policy Bot supports two access control modes configured via `ACCESS_MODE` environment variable.

### Allowlist Mode (Default)

Only users explicitly added to the allowlist can sign in. This is the most secure option for controlled access.

```env
ACCESS_MODE=allowlist
```

### Domain Mode

Any user with an email from allowed domains can sign in.

```env
ACCESS_MODE=domain
ALLOWED_DOMAINS=example.com,company.org
```

### Managing Users via API

All user management endpoints require admin authentication.

#### List All Users
```bash
curl https://your-domain.com/api/admin/users \
  -H "Cookie: <session-cookie>"
```

#### Add a User
```bash
curl -X POST https://your-domain.com/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "email": "user@example.com",
    "role": "user",
    "name": "John Doe"
  }'
```

Roles:
- `admin` - Full access including user management and document administration
- `user` - Can use chat and upload documents to threads

#### Remove a User
```bash
curl -X DELETE "https://your-domain.com/api/admin/users?email=user@example.com" \
  -H "Cookie: <session-cookie>"
```

#### Change User Role
```bash
curl -X PATCH https://your-domain.com/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "email": "user@example.com",
    "role": "admin"
  }'
```

### User Data Storage

Users are stored in `data/allowed-users.json`:

```json
{
  "users": [
    {
      "email": "admin@example.com",
      "name": "Admin User",
      "role": "admin",
      "addedAt": "2024-12-02T12:00:00.000Z",
      "addedBy": "system"
    },
    {
      "email": "user@example.com",
      "name": "Regular User",
      "role": "user",
      "addedAt": "2024-12-02T13:00:00.000Z",
      "addedBy": "admin@example.com"
    }
  ]
}
```

### Initial Setup

On first deployment, users from `ADMIN_EMAILS` environment variable are automatically added as admins. You can then use the API to add more users.

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

## Documentation

- [Solution Architecture](docs/SOLUTION.md)
- [API Specification](docs/API_SPECIFICATION.md)
- [Infrastructure Guide](docs/INFRASTRUCTURE.md)
- [Database Schema](docs/DATABASE.md)

## License

MIT
