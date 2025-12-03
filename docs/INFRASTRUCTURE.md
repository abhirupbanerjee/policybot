# Policy Bot - Infrastructure & Deployment

## Overview

Policy Bot uses Docker Compose for containerized deployment with three environments:
- **Local Development**: Local services with hot reload
- **Pre-Production**: Full stack with TLS (policybot.abhirup.app)
- **Production**: To be configured later

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DOCKER HOST                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         TRAEFIK                                  │    │
│  │                    (Reverse Proxy + TLS)                         │    │
│  │                       Port 443                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      NEXT.JS APP                                 │    │
│  │                    (Port 3000 internal)                          │    │
│  │                                                                  │    │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │    │
│  │   │  Chat API    │  │  Admin API   │  │  Thread API  │          │    │
│  │   └──────────────┘  └──────────────┘  └──────────────┘          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│         │                      │                      │                  │
│         ▼                      ▼                      ▼                  │
│  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐         │
│  │  CHROMADB   │        │    REDIS    │        │  FILESYSTEM │         │
│  │  Port 8000  │        │  Port 6379  │        │   /app/data │         │
│  │  (internal) │        │  (internal) │        │   (volume)  │         │
│  └─────────────┘        └─────────────┘        └─────────────┘         │
│         │                      │                      │                  │
│         ▼                      ▼                      ▼                  │
│  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐         │
│  │ chroma_data │        │ redis_data  │        │  app_data   │         │
│  │  (volume)   │        │  (volume)   │        │  (volume)   │         │
│  └─────────────┘        └─────────────┘        └─────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   OPENAI API    │
                    │   (External)    │
                    └─────────────────┘
```

---

## Environment Files

### Local Development (.env.local)

```env
# OpenAI
OPENAI_API_KEY=sk-your-api-key-here

# Mistral (Optional - for advanced PDF OCR)
MISTRAL_API_KEY=your-mistral-api-key

# Embeddings (defaults shown)
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=3072

# Chroma
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Redis
REDIS_URL=redis://localhost:6379

# Auth (disabled for local dev)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-dev-secret-change-in-production
AUTH_DISABLED=true

# Admin
ADMIN_EMAILS=mailabhirupbanerjee@gmail.com

# Storage
DATA_DIR=./data
```

### Pre-Production (.env.preprod)

```env
# OpenAI
OPENAI_API_KEY=sk-your-api-key-here

# Mistral (Optional - for advanced PDF OCR)
MISTRAL_API_KEY=your-mistral-api-key

# Embeddings
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=3072

# Chroma (internal Docker network)
CHROMA_HOST=chroma
CHROMA_PORT=8000

# Redis (internal Docker network)
REDIS_URL=redis://redis:6379

# Auth
NEXTAUTH_URL=https://policybot.abhirup.app
NEXTAUTH_SECRET=generate-32-char-random-string

# Azure AD OAuth
AZURE_AD_CLIENT_ID=your-azure-client-id
AZURE_AD_CLIENT_SECRET=your-azure-client-secret
AZURE_AD_TENANT_ID=your-azure-tenant-id

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Access Control
ACCESS_MODE=allowlist
# ALLOWED_DOMAINS=example.com,company.org  # Only used when ACCESS_MODE=domain

AUTH_DISABLED=false

# Admin
ADMIN_EMAILS=mailabhirupbanerjee@gmail.com

# Storage
DATA_DIR=/app/data

# Domain
DOMAIN=policybot.abhirup.app
ACME_EMAIL=mailabhirupbanerjee@gmail.com
```

### Production (.env.prod)

```env
# To be configured later
```

---

## Docker Compose Files

### Development Stack (docker-compose.dev.yml)

For local development - runs only Chroma and Redis.

```yaml
version: '3.8'

services:
  chroma:
    image: chromadb/chroma:latest
    container_name: policy-bot-chroma
    ports:
      - "8000:8000"
    volumes:
      - chroma_data:/chroma/chroma
    environment:
      - ANONYMIZED_TELEMETRY=false
      - ALLOW_RESET=true
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/heartbeat"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    container_name: policy-bot-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  chroma_data:
    name: policy-bot-chroma-data
  redis_data:
    name: policy-bot-redis-data
```

### Pre-Production/Production Stack (docker-compose.yml)

Full stack with Traefik for TLS.

```yaml
services:
  traefik:
    image: traefik:v3.0
    container_name: policy-bot-traefik
    command:
      - "--api.insecure=false"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--entrypoints.web.http.redirections.entryPoint.to=websecure"
      - "--entrypoints.web.http.redirections.entryPoint.scheme=https"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt
    networks:
      - policy-bot-network
    restart: unless-stopped

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: policy-bot-app
    environment:
      - NODE_ENV=production
      - CHROMA_HOST=chroma
      - CHROMA_PORT=8000
      - REDIS_URL=redis://redis:6379
      - DATA_DIR=/app/data
    env_file:
      - .env
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(`${DOMAIN}`)"
      - "traefik.http.routers.app.entrypoints=websecure"
      - "traefik.http.routers.app.tls.certresolver=letsencrypt"
      - "traefik.http.services.app.loadbalancer.server.port=3000"
    volumes:
      - app_data:/app/data
    depends_on:
      chroma:
        condition: service_started
      redis:
        condition: service_healthy
    networks:
      - policy-bot-network
    restart: unless-stopped

  chroma:
    image: chromadb/chroma:latest
    container_name: policy-bot-chroma
    volumes:
      - chroma_data:/chroma/chroma
    environment:
      - ANONYMIZED_TELEMETRY=false
      - ALLOW_RESET=false
      - IS_PERSISTENT=TRUE
    networks:
      - policy-bot-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: policy-bot-redis
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - policy-bot-network
    restart: unless-stopped

networks:
  policy-bot-network:
    name: policy-bot-network

volumes:
  letsencrypt:
    name: policy-bot-letsencrypt
  app_data:
    name: policy-bot-app-data
  chroma_data:
    name: policy-bot-chroma-data
  redis_data:
    name: policy-bot-redis-data
```

**Note**: ChromaDB no longer uses a healthcheck as the Python-based check was unreliable. The app uses `service_started` dependency instead.

---

## Dockerfile

Multi-stage build for production.

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1

# Create public directory if it doesn't exist
RUN mkdir -p public

RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create data directory
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Note**: Uses `npm ci` (not `npm ci --only=production`) because TypeScript and other devDependencies are required during the build stage.

---

## Next.js Configuration

### next.config.ts

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',  // Required for Docker
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',  // For admin uploads
    },
  },
  images: {
    unoptimized: true,  // Simplify for self-hosted
  },
};

export default nextConfig;
```

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- OpenAI API key

### Steps

```bash
# 1. Clone repository
git clone <repo-url>
cd policy-bot

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local
# Edit .env.local with your OpenAI API key

# 4. Start infrastructure services
docker compose -f docker-compose.dev.yml up -d

# 5. Wait for services to be healthy
docker compose -f docker-compose.dev.yml ps

# 6. Start development server
npm run dev

# 7. Open browser
# http://localhost:3000
```

### Useful Commands

```bash
# View service logs
docker compose -f docker-compose.dev.yml logs -f chroma
docker compose -f docker-compose.dev.yml logs -f redis

# Restart services
docker compose -f docker-compose.dev.yml restart

# Stop services
docker compose -f docker-compose.dev.yml down

# Stop and remove volumes (clean slate)
docker compose -f docker-compose.dev.yml down -v
```

---

## Pre-Production Deployment

### Server Requirements

- Ubuntu 22.04+ or similar Linux
- Docker 24+
- Docker Compose v2
- 4GB RAM minimum
- 20GB disk space
- Ports 80, 443 open

### DNS Configuration

Point domain to server IP:
```
policybot.abhirup.app → <SERVER_IP>
```

### Deployment Steps

```bash
# 1. SSH to server
ssh user@server

# 2. Clone repository
git clone <repo-url>
cd policy-bot

# 3. Create production environment file
cp .env.example .env
# Edit .env with production values

# Required values:
# - OPENAI_API_KEY
# - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
# - AZURE_AD_* credentials
# - DOMAIN=policybot.abhirup.app
# - ACME_EMAIL=mailabhirupbanerjee@gmail.com

# 4. Build and start
docker compose up -d --build

# 5. Check status
docker compose ps

# 6. View logs
docker compose logs -f app

# 7. Verify TLS certificate
curl -I https://policybot.abhirup.app
```

### Initial Document Ingestion

```bash
# 1. Copy policy documents to server
scp -r documents/ user@server:~/policy-bot/data/global-docs/

# 2. Access admin panel
# https://policybot.abhirup.app/admin

# 3. Upload documents through UI
# Or use API:
curl -X POST https://policybot.abhirup.app/api/admin/documents \
  -H "Cookie: <session-cookie>" \
  -F "file=@Leave_Policy.pdf"
```

---

## Operations

### Monitoring

```bash
# Container status
docker compose ps

# Resource usage
docker stats

# Application logs
docker compose logs -f app

# All logs
docker compose logs -f
```

### Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/policy-bot"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup app data (threads, documents)
docker run --rm \
  -v policy-bot-app-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czvf /backup/app-data-$DATE.tar.gz -C /data .

# Backup ChromaDB
docker run --rm \
  -v policy-bot-chroma-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czvf /backup/chroma-$DATE.tar.gz -C /data .

# Backup Redis
docker run --rm \
  -v policy-bot-redis-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czvf /backup/redis-$DATE.tar.gz -C /data .

# Keep last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Restore

```bash
#!/bin/bash
# restore.sh

BACKUP_DIR="/backups/policy-bot"
DATE=$1  # Pass date as argument

if [ -z "$DATE" ]; then
  echo "Usage: ./restore.sh YYYYMMDD_HHMMSS"
  exit 1
fi

# Stop services
docker compose down

# Restore app data
docker run --rm \
  -v policy-bot-app-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine sh -c "rm -rf /data/* && tar xzvf /backup/app-data-$DATE.tar.gz -C /data"

# Restore ChromaDB
docker run --rm \
  -v policy-bot-chroma-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine sh -c "rm -rf /data/* && tar xzvf /backup/chroma-$DATE.tar.gz -C /data"

# Restore Redis
docker run --rm \
  -v policy-bot-redis-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine sh -c "rm -rf /data/* && tar xzvf /backup/redis-$DATE.tar.gz -C /data"

# Start services
docker compose up -d

echo "Restore completed from: $DATE"
```

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose up -d --build

# Verify
docker compose ps
docker compose logs -f app
```

### Rollback

```bash
# If update fails, rollback to previous image
docker compose down
git checkout <previous-commit>
docker compose up -d --build
```

---

## Health Checks

### Endpoints

| Service | URL | Expected |
|---------|-----|----------|
| App | `/api/auth/session` | 200 OK |
| Chroma | `http://chroma:8000/api/v1/heartbeat` | 200 OK |
| Redis | `redis-cli ping` | PONG |

### Health Check Script

```bash
#!/bin/bash
# healthcheck.sh

APP_URL="https://policybot.abhirup.app"

# Check app
if curl -sf "$APP_URL/api/auth/session" > /dev/null; then
  echo "✓ App: healthy"
else
  echo "✗ App: unhealthy"
fi

# Check Chroma
if docker exec policy-bot-chroma curl -sf http://localhost:8000/api/v1/heartbeat > /dev/null; then
  echo "✓ Chroma: healthy"
else
  echo "✗ Chroma: unhealthy"
fi

# Check Redis
if docker exec policy-bot-redis redis-cli ping | grep -q PONG; then
  echo "✓ Redis: healthy"
else
  echo "✗ Redis: unhealthy"
fi
```

---

## Security Checklist

### Before Deployment

- [ ] Generate strong `NEXTAUTH_SECRET` (32+ characters)
- [ ] Configure Azure AD app registration
- [ ] Configure Google OAuth credentials (optional)
- [ ] Set `ACCESS_MODE` (allowlist or domain)
- [ ] Add admin emails to `ADMIN_EMAILS`
- [ ] Verify `.env` is in `.gitignore`

### After Deployment

- [ ] Verify TLS certificate is valid
- [ ] Test Azure AD login flow
- [ ] Test Google OAuth login flow (if configured)
- [ ] Verify admin access control
- [ ] Add initial users to allowlist (if ACCESS_MODE=allowlist)
- [ ] Test file upload limits
- [ ] Check CORS settings

### Ongoing

- [ ] Monitor for unauthorized access attempts
- [ ] Review container logs weekly
- [ ] Update base images monthly
- [ ] Rotate secrets quarterly
- [ ] Review user allowlist regularly

---

## Troubleshooting

### Common Issues

#### TLS Certificate Not Issued

```bash
# Check Traefik logs
docker compose logs traefik

# Verify DNS propagation
dig policybot.abhirup.app

# Check Let's Encrypt rate limits
# https://letsencrypt.org/docs/rate-limits/
```

#### ChromaDB Connection Failed

```bash
# Check if running
docker compose ps chroma

# Check logs
docker compose logs chroma

# Test connection from app container
docker exec policy-bot-app curl http://chroma:8000/api/v1/heartbeat
```

#### Redis Connection Failed

```bash
# Check if running
docker compose ps redis

# Check logs
docker compose logs redis

# Test connection
docker exec policy-bot-redis redis-cli ping
```

#### Out of Memory

```bash
# Check memory usage
docker stats

# Increase swap if needed
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## Resource Requirements

### Development

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Disk | 10 GB | 20 GB |

### Pre-Production / Production

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Disk | 20 GB | 50 GB |
| Network | 10 Mbps | 100 Mbps |

---

## Cost Estimation

### OpenAI API (Per Month, Estimated)

| Model | Usage | Cost |
|-------|-------|------|
| gpt-4o-mini | ~100K tokens/day | ~$15 |
| text-embedding-3-small | ~50K tokens/day | ~$1 |
| whisper-1 | ~1 hour audio/day | ~$18 |

**Total: ~$35/month** (for moderate usage)

### Infrastructure (Self-Hosted VM)

| Provider | Spec | Cost |
|----------|------|------|
| Azure B2s | 2 vCPU, 4GB RAM | ~$30/month |
| DigitalOcean | 2 vCPU, 4GB RAM | ~$24/month |
| AWS t3.medium | 2 vCPU, 4GB RAM | ~$30/month |

**Total Infrastructure: ~$25-35/month**
