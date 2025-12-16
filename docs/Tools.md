# Tools System

This document describes the AI tools system that extends the bot's capabilities beyond text generation.

---

## Table of Contents

1. [Overview](#overview)
2. [Tool Categories](#tool-categories)
3. [Web Search Tool](#web-search-tool)
4. [Document Generator Tool](#document-generator-tool)
5. [Data Visualization Tool](#data-visualization-tool)
6. [Tool Configuration](#tool-configuration)
7. [Category-Level Overrides](#category-level-overrides)
8. [API Reference](#api-reference)

---

## Overview

Tools are capabilities that extend the AI assistant beyond basic text generation. The system supports two types of tools:

| Category | Description | Invocation |
|----------|-------------|------------|
| **Autonomous** | LLM-triggered via OpenAI function calling | AI decides when to call |
| **Processor** | Post-response output processors | Applied after AI response |

### Architecture

```
User Message
    ↓
AI receives tool definitions (autonomous tools only)
    ↓
AI decides to call tool → returns tool_call with args
    ↓
Backend executes tool
    ↓
Tool result returned to AI
    ↓
AI generates final response using tool results
```

---

## Tool Categories

### Autonomous Tools

Autonomous tools are sent to OpenAI as function definitions. The LLM decides when to invoke them based on user queries.

**Current autonomous tools:**
- `web_search` - Search the web for current information
- `doc_gen` - Generate formatted documents (PDF, DOCX, Markdown)

### Processor Tools

Processor tools are applied to the AI's response after generation. They transform or enhance the output.

**Planned processor tools:**
- `data_viz` - Generate charts and visualizations

---

## Web Search Tool

### Purpose

Enables the AI to search the web for current information when local documents are insufficient or when users need up-to-date data.

### Provider

**Tavily API** - A search API optimized for AI applications with support for:
- Topic-specific searches (general, news, finance)
- Domain filtering (include/exclude)
- Configurable search depth

### Configuration

```typescript
interface WebSearchConfig {
  apiKey: string;              // Tavily API key (required)
  defaultTopic: 'general' | 'news' | 'finance';
  defaultSearchDepth: 'basic' | 'advanced';
  maxResults: number;          // 1-10, default: 5
  includeDomains: string[];    // Only search these domains
  excludeDomains: string[];    // Never search these domains
  cacheTTLSeconds: number;     // 60-2592000, default: 3600
}
```

### Default Configuration

```json
{
  "enabled": false,
  "config": {
    "apiKey": "",
    "defaultTopic": "general",
    "defaultSearchDepth": "basic",
    "maxResults": 5,
    "includeDomains": [],
    "excludeDomains": [],
    "cacheTTLSeconds": 3600
  }
}
```

### OpenAI Function Schema

```json
{
  "name": "web_search",
  "description": "Search the web for current information on a topic. Use this when you need up-to-date information that may not be in the knowledge base.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The search query"
      },
      "max_results": {
        "type": "number",
        "description": "Maximum number of results to return",
        "default": 5
      }
    },
    "required": ["query"]
  }
}
```

### Caching

- Results are cached in Redis using query as key
- Cache TTL is configurable (default: 1 hour)
- Cache is invalidated when configuration changes

### Example Usage

**User:** "What are the latest government guidelines on remote work?"

**AI Response:**
> Based on my web search, here are the latest remote work guidelines:
>
> According to a recent announcement from gov.sg...
>
> Sources:
> - 🌐 [WEB] gov.sg - Remote Work Guidelines (searched: Dec 2024)

---

## Document Generator Tool

### Purpose

Enables the AI to generate formatted documents in multiple formats (PDF, DOCX, Markdown) with customizable branding.

### Supported Formats

| Format | Extension | Use Case |
|--------|-----------|----------|
| **PDF** | `.pdf` | Official documents, reports |
| **DOCX** | `.docx` | Editable Word documents |
| **Markdown** | `.md` | Technical documentation |

### Configuration

```typescript
interface DocGenConfig {
  defaultFormat: 'pdf' | 'docx' | 'md';
  enabledFormats: ('pdf' | 'docx' | 'md')[];
  branding: {
    enabled: boolean;
    logoUrl?: string;
    organizationName?: string;
    primaryColor?: string;      // Hex color (e.g., "#1E40AF")
    fontFamily?: string;
  };
  header: {
    enabled: boolean;
    content?: string;           // Header text
  };
  footer: {
    enabled: boolean;
    content?: string;           // Footer text
    includePageNumber: boolean;
  };
  expirationDays: number;       // 0 = never expire, default: 30
  maxDocumentSizeMB: number;    // 1-100, default: 50
}
```

### Default Configuration

```json
{
  "enabled": true,
  "config": {
    "defaultFormat": "pdf",
    "enabledFormats": ["pdf", "docx", "md"],
    "branding": {
      "enabled": false,
      "logoUrl": "",
      "organizationName": "",
      "primaryColor": "#1E40AF",
      "fontFamily": "Helvetica"
    },
    "header": {
      "enabled": false,
      "content": ""
    },
    "footer": {
      "enabled": false,
      "content": "",
      "includePageNumber": true
    },
    "expirationDays": 30,
    "maxDocumentSizeMB": 50
  }
}
```

### OpenAI Function Schema

```json
{
  "name": "doc_gen",
  "description": "Generate a formatted document from the conversation content. Use this when the user asks for a report, summary, or document export.",
  "parameters": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "Document title"
      },
      "content": {
        "type": "string",
        "description": "Document content in Markdown format"
      },
      "format": {
        "type": "string",
        "enum": ["pdf", "docx", "md"],
        "description": "Output format"
      }
    },
    "required": ["title", "content", "format"]
  }
}
```

### Document Builders

The document generation system uses specialized builders for each format:

| Builder | File | Technology |
|---------|------|------------|
| PDF Builder | `pdf-builder.ts` | PDFKit |
| DOCX Builder | `docx-builder.ts` | docx library |
| MD Builder | `md-builder.ts` | File writer |

### Storage and Expiration

- Generated documents are stored in `/uploads/outputs/`
- Documents can be set to expire after N days
- Download count is tracked per document
- Expired documents are automatically cleaned up

### Example Usage

**User:** "Create a PDF summary of our leave policy discussion"

**AI Response:**
> I've generated a PDF document summarizing our leave policy discussion.
>
> 📄 [Download Leave Policy Summary (PDF)](link)
>
> The document includes:
> - Annual leave entitlements
> - Application procedures
> - Approval workflow

---

## Data Visualization Tool

### Purpose

Generates charts and visualizations from data discussed in conversations.

### Status

**Planned for Phase 3** - Currently not implemented.

### Configuration (Planned)

```typescript
interface DataVizConfig {
  defaultChartType: 'bar' | 'line' | 'pie' | 'area';
  enabledChartTypes: ('bar' | 'line' | 'pie' | 'area')[];
  maxDataPoints: number;       // Default: 1000
}
```

---

## Tool Configuration

### Database Schema

Tools are configured via three tables:

```sql
-- Global tool configurations
CREATE TABLE tool_configs (
  id TEXT PRIMARY KEY,
  tool_name TEXT UNIQUE NOT NULL,
  is_enabled INTEGER DEFAULT 0,
  config_json TEXT NOT NULL,
  created_at DATETIME,
  updated_at DATETIME,
  updated_by TEXT NOT NULL
);

-- Audit trail for changes
CREATE TABLE tool_config_audit (
  id INTEGER PRIMARY KEY,
  tool_name TEXT NOT NULL,
  operation TEXT NOT NULL,  -- 'create', 'update', 'delete'
  old_config TEXT,
  new_config TEXT,
  changed_by TEXT NOT NULL,
  changed_at DATETIME
);
```

### Configuration Hierarchy

```
Category Override (if set)
    ↓
Global Config (tool_configs table)
    ↓
Default Config (TOOL_DEFAULTS constant)
```

### Admin UI

Tools are managed in the Admin Dashboard under the **Tools** tab:

1. **View all tools** - List with status, category, last update
2. **Configure tool** - Update settings, enable/disable
3. **Test tool** - Verify connectivity (for API-based tools)
4. **Reset to defaults** - Restore original configuration
5. **Initialize all** - Create database entries for all registered tools

---

## Category-Level Overrides

Superusers can configure tool settings per category they manage.

### Use Cases

- Different branding per category (e.g., different logos for different departments)
- Enable/disable tools for specific categories
- Custom domain filters for web search per category

### Database Schema

```sql
CREATE TABLE category_tool_configs (
  id TEXT PRIMARY KEY,
  category_id INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  is_enabled INTEGER,         -- null = inherit from global
  branding_json TEXT,         -- Category-specific branding
  created_at DATETIME,
  updated_at DATETIME,
  updated_by TEXT NOT NULL,
  UNIQUE(category_id, tool_name)
);
```

### Override Resolution

```typescript
function getEffectiveToolConfig(toolName: string, categoryId: number) {
  const categoryOverride = getCategoryToolConfig(categoryId, toolName);
  const globalConfig = getToolConfig(toolName);

  return {
    enabled: categoryOverride?.isEnabled ?? globalConfig?.isEnabled ?? false,
    branding: categoryOverride?.branding ?? globalConfig?.branding ?? null,
    // ... merge other settings
  };
}
```

---

## API Reference

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/tools` | List all tools with configs |
| POST | `/api/admin/tools` | Initialize all tools to defaults |
| GET | `/api/admin/tools/{name}` | Get tool config + audit history |
| PATCH | `/api/admin/tools/{name}` | Update tool configuration |
| POST | `/api/admin/tools/{name}/test` | Test tool connectivity |

### Superuser Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/superuser/tools` | List tools with category overrides |
| POST | `/api/superuser/tools/{name}` | Set category override |

### Example: Update Tool Configuration

```bash
curl -X PATCH https://policybot.example.com/api/admin/tools/web_search \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "enabled": true,
    "config": {
      "maxResults": 10,
      "defaultSearchDepth": "advanced",
      "includeDomains": ["gov.sg", "mof.gov.sg"]
    }
  }'
```

### Example: Test Tool

```bash
curl -X POST https://policybot.example.com/api/admin/tools/web_search/test \
  -H "Cookie: next-auth.session-token=..."
```

Response:
```json
{
  "tool": "web_search",
  "success": true,
  "message": "Connection successful",
  "latency": 245,
  "testedAt": "2024-12-12T14:30:00Z",
  "testedBy": "admin@example.com"
}
```

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/lib/tools.ts` | Main tool registry and API |
| `src/lib/tools/tavily.ts` | Web search implementation |
| `src/lib/tools/docgen.ts` | Document generator implementation |
| `src/lib/docgen/pdf-builder.ts` | PDF generation |
| `src/lib/docgen/docx-builder.ts` | DOCX generation |
| `src/lib/docgen/md-builder.ts` | Markdown generation |
| `src/lib/docgen/branding.ts` | Branding configuration |
| `src/lib/db/tool-config.ts` | Database operations |
| `src/lib/db/category-tool-config.ts` | Category overrides |
