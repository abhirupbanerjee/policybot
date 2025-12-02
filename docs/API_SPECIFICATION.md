# Policy Bot - API Specification

## Overview

All API endpoints are RESTful and use JSON for request/response bodies unless otherwise specified. Authentication is handled via NextAuth sessions.

**Base URL**: `/api`

---

## Authentication

All endpoints except `/api/auth/*` require authentication.

### Authentication Flow

1. User navigates to protected route
2. Redirected to Azure AD login if no session
3. After successful login, session cookie is set
4. All subsequent requests include session cookie

### Auth Bypass (Development Only)

When `AUTH_DISABLED=true` in environment:
- All routes are accessible without authentication
- A mock user is used: `dev@localhost`

---

## Endpoints

### 1. Authentication

#### `GET/POST /api/auth/*`

NextAuth.js handles all authentication routes.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/signin` | GET | Sign-in page |
| `/api/auth/signout` | POST | Sign out user |
| `/api/auth/session` | GET | Get current session |
| `/api/auth/callback/azure-ad` | GET | OAuth callback |

---

### 2. Chat

#### `POST /api/chat`

Send a message and receive a RAG-powered response.

**Authentication**: Required

**Request Body**:
```typescript
{
  message: string;    // User's question (required)
  threadId: string;   // Thread ID (required)
}
```

**Response** `200 OK`:
```typescript
{
  message: {
    id: string;
    role: "assistant";
    content: string;
    sources: [
      {
        documentName: string;
        pageNumber: number;
        chunkText: string;
        score: number;
      }
    ];
    timestamp: string;  // ISO 8601
  };
  threadId: string;
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"Message is required"` | Missing message in request |
| 400 | `"Thread ID is required"` | Missing threadId in request |
| 401 | `"Unauthorized"` | No valid session |
| 404 | `"Thread not found"` | Thread doesn't exist or belongs to another user |
| 500 | `"Failed to process message"` | Internal error |

**Example**:
```bash
curl -X POST /api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "message": "What is the annual leave policy?",
    "threadId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

---

### 3. Transcription

#### `POST /api/transcribe`

Convert audio to text using OpenAI Whisper.

**Authentication**: Required

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio` | File | Yes | Audio file (webm, mp3, wav, m4a) |

**Response** `200 OK`:
```typescript
{
  text: string;      // Transcribed text
  duration: number;  // Audio duration in seconds
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"No audio file provided"` | Missing audio in request |
| 400 | `"Invalid audio format"` | Unsupported file type |
| 401 | `"Unauthorized"` | No valid session |
| 413 | `"File too large"` | Audio exceeds 25MB limit |
| 500 | `"Transcription failed"` | OpenAI API error |

**Example**:
```bash
curl -X POST /api/transcribe \
  -H "Cookie: next-auth.session-token=..." \
  -F "audio=@recording.webm"
```

---

### 4. Threads

#### `GET /api/threads`

List all threads for the current user.

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Max threads to return |
| `offset` | number | 0 | Pagination offset |

**Response** `200 OK`:
```typescript
{
  threads: [
    {
      id: string;
      title: string;
      createdAt: string;   // ISO 8601
      updatedAt: string;   // ISO 8601
      uploadCount: number;
    }
  ];
  total: number;
}
```

**Example**:
```bash
curl -X GET "/api/threads?limit=10" \
  -H "Cookie: next-auth.session-token=..."
```

---

#### `POST /api/threads`

Create a new thread.

**Authentication**: Required

**Request Body**:
```typescript
{
  title?: string;  // Optional, defaults to "New Thread"
}
```

**Response** `201 Created`:
```typescript
{
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  uploadCount: number;
}
```

**Example**:
```bash
curl -X POST /api/threads \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"title": "Leave Policy Questions"}'
```

---

#### `GET /api/threads/[threadId]`

Get a specific thread with messages.

**Authentication**: Required (must own thread)

**Response** `200 OK`:
```typescript
{
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  uploadCount: number;
  messages: [
    {
      id: string;
      role: "user" | "assistant";
      content: string;
      sources?: Source[];
      attachments?: string[];
      timestamp: string;
    }
  ];
  uploads: string[];  // List of uploaded filenames
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Unauthorized"` | No valid session |
| 404 | `"Thread not found"` | Thread doesn't exist or belongs to another user |

**Example**:
```bash
curl -X GET /api/threads/550e8400-e29b-41d4-a716-446655440000 \
  -H "Cookie: next-auth.session-token=..."
```

---

#### `DELETE /api/threads/[threadId]`

Delete a thread and all associated data.

**Authentication**: Required (must own thread)

**Response** `200 OK`:
```typescript
{
  success: true;
  deleted: {
    threadId: string;
    messageCount: number;
    uploadCount: number;
  };
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Unauthorized"` | No valid session |
| 404 | `"Thread not found"` | Thread doesn't exist or belongs to another user |

**Example**:
```bash
curl -X DELETE /api/threads/550e8400-e29b-41d4-a716-446655440000 \
  -H "Cookie: next-auth.session-token=..."
```

---

#### `PATCH /api/threads/[threadId]`

Update thread metadata (e.g., title).

**Authentication**: Required (must own thread)

**Request Body**:
```typescript
{
  title?: string;  // New title (max 100 characters)
}
```

**Response** `200 OK`:
```typescript
{
  id: string;
  title: string;
  updatedAt: string;
}
```

**Example**:
```bash
curl -X PATCH /api/threads/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"title": "Updated Title"}'
```

---

### 5. Thread Uploads

#### `POST /api/threads/[threadId]/upload`

Upload a PDF to a thread for compliance checking.

**Authentication**: Required (must own thread)

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | PDF file (max 5MB) |

**Constraints**:
- Max 3 files per thread
- Max 5MB per file
- PDF only

**Response** `200 OK`:
```typescript
{
  filename: string;
  size: number;        // Bytes
  uploadCount: number; // Total uploads in thread
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"No file provided"` | Missing file in request |
| 400 | `"Only PDF files allowed"` | Invalid file type |
| 400 | `"Maximum 3 files per thread"` | Upload limit reached |
| 401 | `"Unauthorized"` | No valid session |
| 404 | `"Thread not found"` | Thread doesn't exist |
| 413 | `"File too large (max 5MB)"` | File exceeds size limit |

**Example**:
```bash
curl -X POST /api/threads/550e8400-e29b-41d4-a716-446655440000/upload \
  -H "Cookie: next-auth.session-token=..." \
  -F "file=@document.pdf"
```

---

#### `DELETE /api/threads/[threadId]/upload/[filename]`

Delete an uploaded file from a thread.

**Authentication**: Required (must own thread)

**Response** `200 OK`:
```typescript
{
  success: true;
  filename: string;
  uploadCount: number;  // Remaining uploads
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Unauthorized"` | No valid session |
| 404 | `"Thread not found"` | Thread doesn't exist |
| 404 | `"File not found"` | Upload doesn't exist |

---

### 6. Admin - Documents

#### `GET /api/admin/documents`

List all global policy documents.

**Authentication**: Required (admin only)

**Response** `200 OK`:
```typescript
{
  documents: [
    {
      id: string;
      filename: string;
      size: number;
      chunkCount: number;
      uploadedAt: string;
      uploadedBy: string;
      status: "processing" | "ready" | "error";
      errorMessage?: string;
    }
  ];
  totalChunks: number;
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Unauthorized"` | No valid session |
| 403 | `"Admin access required"` | User is not an admin |

**Example**:
```bash
curl -X GET /api/admin/documents \
  -H "Cookie: next-auth.session-token=..."
```

---

#### `POST /api/admin/documents`

Upload a new policy document to the global store.

**Authentication**: Required (admin only)

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | PDF file (max 50MB) |

**Response** `202 Accepted`:
```typescript
{
  id: string;
  filename: string;
  size: number;
  status: "processing";
  message: "Document is being processed";
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"No file provided"` | Missing file in request |
| 400 | `"Only PDF files allowed"` | Invalid file type |
| 401 | `"Unauthorized"` | No valid session |
| 403 | `"Admin access required"` | User is not an admin |
| 413 | `"File too large (max 50MB)"` | File exceeds size limit |
| 409 | `"Document already exists"` | Filename already in use |

**Example**:
```bash
curl -X POST /api/admin/documents \
  -H "Cookie: next-auth.session-token=..." \
  -F "file=@HR_Handbook.pdf"
```

---

#### `GET /api/admin/documents/[docId]`

Get details of a specific document.

**Authentication**: Required (admin only)

**Response** `200 OK`:
```typescript
{
  id: string;
  filename: string;
  size: number;
  chunkCount: number;
  uploadedAt: string;
  uploadedBy: string;
  status: "processing" | "ready" | "error";
  errorMessage?: string;
  chunks?: [  // Only if status is "ready"
    {
      id: string;
      pageNumber: number;
      preview: string;  // First 100 chars
    }
  ];
}
```

---

#### `DELETE /api/admin/documents/[docId]`

Delete a policy document from the global store.

**Authentication**: Required (admin only)

**Response** `200 OK`:
```typescript
{
  success: true;
  deleted: {
    id: string;
    filename: string;
    chunksRemoved: number;
  };
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Unauthorized"` | No valid session |
| 403 | `"Admin access required"` | User is not an admin |
| 404 | `"Document not found"` | Document doesn't exist |

**Example**:
```bash
curl -X DELETE /api/admin/documents/doc-001 \
  -H "Cookie: next-auth.session-token=..."
```

---

#### `POST /api/admin/documents/[docId]/reindex`

Reindex an existing document (re-extract and re-embed).

**Authentication**: Required (admin only)

**Response** `202 Accepted`:
```typescript
{
  id: string;
  filename: string;
  status: "processing";
  message: "Document is being reindexed";
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Unauthorized"` | No valid session |
| 403 | `"Admin access required"` | User is not an admin |
| 404 | `"Document not found"` | Document doesn't exist |

**Example**:
```bash
curl -X POST /api/admin/documents/doc-001/reindex \
  -H "Cookie: next-auth.session-token=..."
```

---

## Error Response Format

All error responses follow a consistent format:

```typescript
{
  error: string;      // Human-readable error message
  details?: string;   // Additional context (development only)
  code?: string;      // Error code for client handling
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication required |
| `ADMIN_REQUIRED` | Admin privileges required |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid request data |
| `FILE_TOO_LARGE` | Upload exceeds size limit |
| `UPLOAD_LIMIT` | Max uploads reached |
| `SERVICE_ERROR` | Internal service failure |

---

## Rate Limiting

Rate limits are applied per user session:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/chat` | 30 requests | 1 minute |
| `POST /api/transcribe` | 10 requests | 1 minute |
| `POST /api/threads/*/upload` | 10 requests | 1 minute |
| `POST /api/admin/documents` | 5 requests | 1 minute |

**Rate Limit Response** `429 Too Many Requests`:
```typescript
{
  error: "Rate limit exceeded";
  retryAfter: number;  // Seconds until reset
}
```

---

## Webhooks (Future)

For future integrations, webhook support may be added:

| Event | Description |
|-------|-------------|
| `document.processed` | Document ingestion complete |
| `document.error` | Document processing failed |

---

## API Versioning

Current version: **v1** (implicit)

Future versions will use path prefix: `/api/v2/...`

---

## SDK Examples

### JavaScript/TypeScript

```typescript
// Using fetch
async function sendMessage(message: string, threadId: string) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, threadId }),
    credentials: 'include',  // Include session cookie
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

// Upload file
async function uploadDocument(threadId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/api/threads/${threadId}/upload`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  return response.json();
}
```

### cURL

```bash
# Create thread
curl -X POST http://localhost:3000/api/threads \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{"title": "Test Thread"}'

# Send message
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{"message": "What is the leave policy?", "threadId": "THREAD_ID"}'

# Upload document (admin)
curl -X POST http://localhost:3000/api/admin/documents \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -F "file=@policy.pdf"
```
