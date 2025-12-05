# Policy Bot - API Specification

## Overview

All API endpoints are RESTful and use JSON for request/response bodies unless otherwise specified. Authentication is handled via NextAuth sessions.

**Base URL**: `/api`

---

## Authentication

All endpoints except `/api/auth/*` require authentication.

### Authentication Flow

1. User navigates to protected route
2. Redirected to Azure AD or Google login if no session
3. After successful login, session cookie is set
4. All subsequent requests include session cookie

### Access Control Modes

Policy Bot supports two access control modes via `ACCESS_MODE` environment variable:

| Mode | Description |
|------|-------------|
| `allowlist` (default) | Only users in the allowlist can sign in |
| `domain` | Any user from allowed email domains can sign in |

### User Roles

| Role | Access Level |
|------|--------------|
| `admin` | Full system access, manage categories/users/documents |
| `superuser` | Manage user subscriptions for assigned categories |
| `user` | Query documents in subscribed categories |

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
| `/api/auth/callback/azure-ad` | GET | Azure AD OAuth callback |
| `/api/auth/callback/google` | GET | Google OAuth callback |

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
        isWeb?: boolean;  // True if from Tavily web search
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
      categoryIds: number[];  // Selected category IDs
    }
  ];
  total: number;
}
```

---

#### `POST /api/threads`

Create a new thread.

**Authentication**: Required

**Request Body**:
```typescript
{
  title?: string;       // Optional, defaults to "New Thread"
  categoryIds?: number[]; // Optional, category IDs to assign
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
  categoryIds: number[];
}
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
  categoryIds: number[];
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

---

#### `PATCH /api/threads/[threadId]`

Update thread metadata (title or categories).

**Authentication**: Required (must own thread)

**Request Body**:
```typescript
{
  title?: string;       // New title (max 100 characters)
  categoryIds?: number[]; // New category selection
}
```

**Response** `200 OK`:
```typescript
{
  id: string;
  title: string;
  categoryIds: number[];
  updatedAt: string;
}
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

---

### 6. Admin - Categories

#### `GET /api/admin/categories`

List all categories with statistics.

**Authentication**: Required (admin only)

**Response** `200 OK`:
```typescript
{
  categories: [
    {
      id: number;
      name: string;
      slug: string;
      description: string | null;
      createdBy: string;
      createdAt: string;
      documentCount: number;
      superUserCount: number;
      subscriberCount: number;
    }
  ];
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Unauthorized"` | No valid session |
| 403 | `"Admin access required"` | User is not an admin |

---

#### `POST /api/admin/categories`

Create a new category.

**Authentication**: Required (admin only)

**Request Body**:
```typescript
{
  name: string;         // Required: unique category name
  description?: string; // Optional: category description
}
```

**Response** `201 Created`:
```typescript
{
  category: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    createdBy: string;
    createdAt: string;
  };
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"Category name is required"` | Missing name |
| 409 | `"Category \"X\" already exists"` | Duplicate name |

**Example**:
```bash
curl -X POST /api/admin/categories \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"name": "HR", "description": "Human Resources policies"}'
```

---

#### `GET /api/admin/categories/[id]`

Get category details with users and documents.

**Authentication**: Required (admin only)

**Response** `200 OK`:
```typescript
{
  category: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    createdBy: string;
    createdAt: string;
  };
  superUsers: [
    {
      userId: number;
      email: string;
      name: string | null;
    }
  ];
  subscribers: [
    {
      userId: number;
      email: string;
      name: string | null;
      isActive: boolean;
    }
  ];
  documentCount: number;
}
```

---

#### `PUT /api/admin/categories/[id]`

Update a category.

**Authentication**: Required (admin only)

**Request Body**:
```typescript
{
  name?: string;        // New name (must be unique)
  description?: string; // New description
}
```

**Response** `200 OK`:
```typescript
{
  category: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
  };
}
```

---

#### `DELETE /api/admin/categories/[id]`

Delete a category. Documents in this category become unassigned.

**Authentication**: Required (admin only)

**Response** `200 OK`:
```typescript
{
  success: true;
  deleted: {
    id: number;
    name: string;
    documentsUnassigned: number;
  };
}
```

---

### 7. Admin - Documents

#### `GET /api/admin/documents`

List all global policy documents.

**Authentication**: Required (admin only)

**Response** `200 OK`:
```typescript
{
  documents: [
    {
      id: number;
      filename: string;
      size: number;
      chunkCount: number;
      uploadedAt: string;
      uploadedBy: string;
      status: "processing" | "ready" | "error";
      errorMessage?: string;
      isGlobal: boolean;
      categories: [
        {
          categoryId: number;
          categoryName: string;
        }
      ];
    }
  ];
  totalChunks: number;
}
```

---

#### `POST /api/admin/documents`

Upload a new policy document with category assignment.

**Authentication**: Required (admin only)

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | PDF file (max 50MB) |
| `categoryIds` | string | No | JSON array of category IDs |
| `isGlobal` | string | No | `"true"` to index in all categories |

**Response** `202 Accepted`:
```typescript
{
  id: number;
  filename: string;
  size: number;
  status: "processing";
  isGlobal: boolean;
  categoryIds: number[];
  message: "Document is being processed";
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"No file provided"` | Missing file in request |
| 400 | `"Only PDF files allowed"` | Invalid file type |
| 413 | `"File too large (max 50MB)"` | File exceeds size limit |
| 409 | `"Document already exists"` | Filename already in use |

**Example**:
```bash
curl -X POST /api/admin/documents \
  -H "Cookie: next-auth.session-token=..." \
  -F "file=@HR_Handbook.pdf" \
  -F "categoryIds=[1,2]" \
  -F "isGlobal=false"
```

---

#### `GET /api/admin/documents/[docId]`

Get details of a specific document.

**Authentication**: Required (admin only)

**Response** `200 OK`:
```typescript
{
  id: number;
  filename: string;
  size: number;
  chunkCount: number;
  uploadedAt: string;
  uploadedBy: string;
  status: "processing" | "ready" | "error";
  errorMessage?: string;
  isGlobal: boolean;
  categories: [
    {
      categoryId: number;
      categoryName: string;
    }
  ];
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

#### `PATCH /api/admin/documents/[docId]`

Update document category assignments.

**Authentication**: Required (admin only)

**Request Body**:
```typescript
{
  categoryIds?: number[];  // New category assignments
  isGlobal?: boolean;      // Set global flag
}
```

**Response** `200 OK`:
```typescript
{
  id: number;
  filename: string;
  isGlobal: boolean;
  categories: [
    {
      categoryId: number;
      categoryName: string;
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
    id: number;
    filename: string;
    chunksRemoved: number;
  };
}
```

---

#### `POST /api/admin/documents/[docId]/reindex`

Reindex an existing document (re-extract and re-embed).

**Authentication**: Required (admin only)

**Response** `202 Accepted`:
```typescript
{
  id: number;
  filename: string;
  status: "processing";
  message: "Document is being reindexed";
}
```

---

### 8. Admin - User Management

#### `GET /api/admin/users`

List all users with their subscriptions/assignments.

**Authentication**: Required (admin only)

**Response** `200 OK`:
```typescript
{
  users: [
    {
      email: string;
      name?: string;
      role: "admin" | "superuser" | "user";
      addedAt: string;    // ISO 8601
      addedBy: string;    // Email of admin who added
      subscriptions: [    // For regular users
        {
          categoryId: number;
          categoryName: string;
          isActive: boolean;
        }
      ];
      assignedCategories: [  // For super users
        {
          categoryId: number;
          categoryName: string;
        }
      ];
    }
  ];
}
```

---

#### `POST /api/admin/users`

Add a new user with optional subscriptions/assignments.

**Authentication**: Required (admin only)

**Request Body**:
```typescript
{
  email: string;                      // Required: user's email
  role: "admin" | "superuser" | "user";  // Required: user role
  name?: string;                      // Optional: display name
  subscriptions?: number[];           // For role="user": category IDs
  assignedCategories?: number[];      // For role="superuser": category IDs
}
```

**Response** `200 OK`:
```typescript
{
  user: {
    email: string;
    name?: string;
    role: string;
    addedAt: string;
    addedBy: string;
  };
  message: "User added successfully";
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"Email is required"` | Missing email in request |
| 400 | `"Role must be..."` | Invalid role value |
| 400 | `"Category with ID X not found"` | Invalid category ID |

**Example**:
```bash
curl -X POST /api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "email": "user@example.com",
    "role": "user",
    "name": "John Doe",
    "subscriptions": [1, 2]
  }'
```

---

#### `DELETE /api/admin/users`

Remove a user from the allowlist.

**Authentication**: Required (admin only)

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | Yes | Email of user to remove |

**Response** `200 OK`:
```typescript
{
  message: "User removed successfully";
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"Cannot remove yourself"` | Admin tried to remove own account |
| 404 | `"User not found"` | User not in allowlist |

---

#### `PATCH /api/admin/users`

Update a user's role.

**Authentication**: Required (admin only)

**Request Body**:
```typescript
{
  email: string;                      // Required: user's email
  role: "admin" | "superuser" | "user";  // Required: new role
}
```

**Response** `200 OK`:
```typescript
{
  message: "User role updated successfully";
}
```

---

### 9. Admin - User Subscriptions

#### `GET /api/admin/users/[userId]/subscriptions`

Get a user's category subscriptions.

**Authentication**: Required (admin only)

**Response** `200 OK`:
```typescript
{
  user: {
    id: number;
    email: string;
    name: string | null;
    role: string;
  };
  subscriptions: [
    {
      categoryId: number;
      categoryName: string;
      categorySlug: string;
      isActive: boolean;
    }
  ];
}
```

---

#### `POST /api/admin/users/[userId]/subscriptions`

Add a subscription for a user.

**Authentication**: Required (admin only)

**Request Body**:
```typescript
{
  categoryId: number;  // Category ID to subscribe
}
```

**Response** `201 Created`:
```typescript
{
  success: true;
  subscription: {
    userId: number;
    categoryId: number;
    categoryName: string;
    isActive: boolean;
  };
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 404 | `"User not found"` | Invalid user ID |
| 404 | `"Category not found"` | Invalid category ID |
| 409 | `"User is already subscribed"` | Duplicate subscription |

---

#### `PUT /api/admin/users/[userId]/subscriptions`

Toggle subscription active status.

**Authentication**: Required (admin only)

**Request Body**:
```typescript
{
  categoryId: number;
  isActive: boolean;
}
```

**Response** `200 OK`:
```typescript
{
  success: true;
  subscription: {
    userId: number;
    categoryId: number;
    isActive: boolean;
  };
}
```

---

#### `DELETE /api/admin/users/[userId]/subscriptions`

Remove a subscription from a user.

**Authentication**: Required (admin only)

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `categoryId` | number | Yes | Category ID to unsubscribe |

**Response** `200 OK`:
```typescript
{
  success: true;
  removed: {
    userId: number;
    categoryId: number;
  };
}
```

---

### 10. Super User - Document Management

Super users can upload and manage documents within their assigned categories.

#### `GET /api/superuser/documents`

Get documents in super user's assigned categories.

**Authentication**: Required (superuser only)

**Response** `200 OK`:
```typescript
{
  assignedCategories: [
    {
      categoryId: number;
      categoryName: string;
      categorySlug: string;
    }
  ];
  documents: [
    {
      id: number;
      filename: string;
      size: number;
      status: "processing" | "ready" | "error";
      uploadedBy: string;
      uploadedAt: string;
      categories: [
        {
          categoryId: number;
          categoryName: string;
        }
      ];
    }
  ];
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Unauthorized"` | No valid session |
| 403 | `"Super user access required"` | User is not a super user |

---

#### `POST /api/superuser/documents`

Upload a document to one of super user's assigned categories.

**Authentication**: Required (superuser only)

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | PDF file (max 50MB) |
| `categoryId` | string | Yes | Category ID (must be assigned to super user) |

**Constraints**:
- Max 50MB per file
- PDF only
- Cannot set `isGlobal` flag (always false for super users)
- Category must be assigned to the super user

**Response** `202 Accepted`:
```typescript
{
  id: number;
  filename: string;
  size: number;
  status: "processing";
  message: "Document is being processed";
  category: {
    categoryId: number;
    categoryName: string;
  };
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"No file provided"` | Missing file in request |
| 400 | `"Category ID is required"` | Missing categoryId |
| 400 | `"Only PDF files allowed"` | Invalid file type |
| 403 | `"You do not have access to upload to this category"` | Category not assigned |
| 404 | `"Category not found"` | Invalid category ID |
| 413 | `"File too large (max 50MB)"` | File exceeds size limit |

**Example**:
```bash
curl -X POST /api/superuser/documents \
  -H "Cookie: next-auth.session-token=..." \
  -F "file=@HR_Policy.pdf" \
  -F "categoryId=1"
```

---

#### `DELETE /api/superuser/documents/[docId]`

Delete a document (only if uploaded by this super user).

**Authentication**: Required (superuser only)

**Constraints**:
- Document must be in one of super user's assigned categories
- Document must have been uploaded by this super user

**Response** `200 OK`:
```typescript
{
  success: true;
  deleted: {
    id: number;
    filename: string;
    chunksRemoved: number;
  };
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"Invalid document ID"` | Non-numeric document ID |
| 403 | `"You do not have access to delete this document"` | Document not in assigned categories |
| 403 | `"You can only delete documents you uploaded"` | Not the uploader |
| 404 | `"Document not found"` | Invalid document ID |

**Example**:
```bash
curl -X DELETE /api/superuser/documents/5 \
  -H "Cookie: next-auth.session-token=..."
```

---

### 11. Super User - User Management

Super users can manage subscriptions for regular users within their assigned categories.

#### `GET /api/superuser/users`

Get users subscribed to super user's assigned categories.

**Authentication**: Required (superuser only)

**Response** `200 OK`:
```typescript
{
  assignedCategories: [
    {
      categoryId: number;
      categoryName: string;
      categorySlug: string;
    }
  ];
  users: [
    {
      id: number;
      email: string;
      name: string | null;
      subscriptions: [
        {
          categoryId: number;
          categoryName: string;
          isActive: boolean;
        }
      ];
    }
  ];
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Unauthorized"` | No valid session |
| 403 | `"Super user access required"` | User is not a super user |

---

#### `POST /api/superuser/users`

Add subscription for a user to one of super user's categories.

**Authentication**: Required (superuser only)

**Request Body**:
```typescript
{
  userEmail: string;   // Target user's email
  categoryId: number;  // Category ID (must be assigned to super user)
}
```

**Response** `201 Created`:
```typescript
{
  success: true;
  subscription: {
    userId: number;
    categoryId: number;
    categoryName: string;
    isActive: boolean;
  };
}
```

**Error Responses**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"userEmail and categoryId are required"` | Missing parameters |
| 400 | `"Can only manage subscriptions for regular users"` | Target is admin/superuser |
| 403 | `"You do not have access to manage this category"` | Category not assigned |
| 404 | `"User not found"` | Target user doesn't exist |
| 409 | `"User is already subscribed"` | Duplicate subscription |

**Example**:
```bash
curl -X POST /api/superuser/users \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "userEmail": "user@example.com",
    "categoryId": 1
  }'
```

---

#### `DELETE /api/superuser/users`

Remove subscription from one of super user's categories.

**Authentication**: Required (superuser only)

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userEmail` | string | Yes | Target user's email |
| `categoryId` | number | Yes | Category ID to unsubscribe |

**Response** `200 OK`:
```typescript
{
  success: true;
  removed: {
    userId: number;
    categoryId: number;
  };
}
```

**Example**:
```bash
curl -X DELETE "/api/superuser/users?userEmail=user@example.com&categoryId=1" \
  -H "Cookie: next-auth.session-token=..."
```

---

### 12. Admin - Settings

#### `GET /api/admin/settings`

Get all configurable settings.

**Authentication**: Required (admin only)

**Response** `200 OK`:
```typescript
{
  settings: {
    llmModel: string;
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    ragCacheTtl: number;      // Seconds
    tavilyCacheTtl: number;   // Seconds
    tavilyEnabled: boolean;
    systemPrompt: string;
  };
}
```

---

#### `PATCH /api/admin/settings`

Update settings.

**Authentication**: Required (admin only)

**Request Body**:
```typescript
{
  llmModel?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  ragCacheTtl?: number;
  tavilyCacheTtl?: number;
  tavilyEnabled?: boolean;
  systemPrompt?: string;
  branding?: {
    botName?: string;
    botIcon?: string;
  };
}
```

**Response** `200 OK`:
```typescript
{
  settings: { /* updated settings */ };
  message: "Settings updated successfully";
}
```

---

### 13. Branding

#### `GET /api/branding`

Get branding settings (public endpoint, no authentication required).

**Authentication**: Not required

**Response** `200 OK`:
```typescript
{
  botName: string;   // e.g., "Policy Bot"
  botIcon: string;   // e.g., "policy"
  availableIcons: [
    { key: string; label: string; lucideIcon: string }
  ];
}
```

**Available Icon Keys**:
- `government` - Landmark icon
- `operations` - Settings icon
- `finance` - DollarSign icon
- `kpi` - BarChart3 icon
- `logs` - FileText icon
- `data` - Database icon
- `monitoring` - Activity icon
- `architecture` - Layers icon
- `internet` - Globe icon
- `systems` - Server icon
- `policy` - ScrollText icon (default)

---

### 14. User Subscriptions

#### `GET /api/user/subscriptions`

Get the current user's category subscriptions.

**Authentication**: Required

**Response** `200 OK`:
```typescript
{
  subscriptions: [
    {
      categoryId: number;
      categoryName: string;
      categorySlug: string;
      isActive: boolean;
    }
  ];
}
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
| `SUPERUSER_REQUIRED` | Super user privileges required |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid request data |
| `FILE_TOO_LARGE` | Upload exceeds size limit |
| `UPLOAD_LIMIT` | Max uploads reached |
| `DUPLICATE` | Resource already exists |
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

## API Versioning

Current version: **v1** (implicit)

Future versions will use path prefix: `/api/v2/...`

---

## SDK Examples

### JavaScript/TypeScript

```typescript
// Send chat message
async function sendMessage(message: string, threadId: string) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, threadId }),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

// Upload document with categories
async function uploadDocument(file: File, categoryIds: number[], isGlobal: boolean) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('categoryIds', JSON.stringify(categoryIds));
  formData.append('isGlobal', String(isGlobal));

  const response = await fetch('/api/admin/documents', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  return response.json();
}

// Create user with subscriptions
async function createUser(email: string, role: string, subscriptions: number[]) {
  const response = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role, subscriptions }),
    credentials: 'include',
  });

  return response.json();
}
```

### cURL

```bash
# Create category
curl -X POST http://localhost:3000/api/admin/categories \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=TOKEN" \
  -d '{"name": "HR", "description": "Human Resources"}'

# Create user with subscriptions
curl -X POST http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=TOKEN" \
  -d '{"email": "user@example.com", "role": "user", "subscriptions": [1,2]}'

# Upload document to categories
curl -X POST http://localhost:3000/api/admin/documents \
  -H "Cookie: next-auth.session-token=TOKEN" \
  -F "file=@policy.pdf" \
  -F "categoryIds=[1,2]"

# Super user: add subscription
curl -X POST http://localhost:3000/api/superuser/users \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=TOKEN" \
  -d '{"userEmail": "user@example.com", "categoryId": 1}'

# Super user: upload document to assigned category
curl -X POST http://localhost:3000/api/superuser/documents \
  -H "Cookie: next-auth.session-token=TOKEN" \
  -F "file=@HR_Policy.pdf" \
  -F "categoryId=1"

# Super user: delete own document
curl -X DELETE http://localhost:3000/api/superuser/documents/5 \
  -H "Cookie: next-auth.session-token=TOKEN"
```
