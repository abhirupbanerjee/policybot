# Tools System

This document describes the AI tools system that extends the bot's capabilities beyond text generation.

---

## Table of Contents

1. [Overview](#overview)
2. [Tool Categories](#tool-categories)
3. [Web Search Tool](#web-search-tool)
4. [Document Generator Tool](#document-generator-tool)
5. [Data Source Tool](#data-source-tool)
6. [Chart Generator Tool](#chart-generator-tool)
7. [Function API Tool](#function-api-tool)
8. [Task Planner Tool](#task-planner-tool)
9. [YouTube Tool](#youtube-tool)
10. [Tool Configuration](#tool-configuration)
11. [Category-Level Overrides](#category-level-overrides)
12. [API Reference](#api-reference)

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
- `data_source` - Query external APIs and CSV data with visualization
- `chart_gen` - Generate charts from LLM-constructed data
- `function_api` - Dynamic function calling with OpenAI-format schemas
- `task_planner` - Manage multi-step task plans for complex operations
- `youtube` - Extract transcripts from YouTube videos

### Processor Tools

Processor tools are applied to the AI's response after generation. They transform or enhance the output.

**Note:** Data visualization is now integrated into the `data_source` tool as automatic chart rendering.

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
  maxResults: number;          // 1-20, default: 10
  includeDomains: string[];    // Only search these domains
  excludeDomains: string[];    // Never search these domains
  cacheTTLSeconds: number;     // 60-2592000, default: 3600
  includeAnswer: 'none' | 'basic' | 'advanced';  // AI-generated answer summary
}
```

### Default Configuration

```json
{
  "enabled": false,
  "config": {
    "apiKey": "",
    "defaultTopic": "general",
    "defaultSearchDepth": "advanced",
    "maxResults": 10,
    "includeDomains": [],
    "excludeDomains": [],
    "cacheTTLSeconds": 3600,
    "includeAnswer": "basic"
  }
}
```

### OpenAI Function Schema

The LLM can optionally override search parameters per query, with admin config as defaults:

```json
{
  "name": "web_search",
  "description": "Search the web for current information, news, or data not available in the organizational knowledge base.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query to find relevant web information"
      },
      "max_results": {
        "type": "number",
        "description": "Number of results (1-20). Use higher values for comprehensive research, lower for quick facts. Defaults to admin setting if not specified."
      },
      "search_depth": {
        "type": "string",
        "enum": ["basic", "advanced"],
        "description": "Search depth: 'basic' for quick searches (3-5 results), 'advanced' for thorough research (10+ results). Defaults to admin setting."
      },
      "include_answer": {
        "type": "string",
        "enum": ["none", "basic", "advanced"],
        "description": "Include AI-generated answer: 'none' = disabled, 'basic' = quick summary, 'advanced' = comprehensive analysis. Defaults to admin setting."
      }
    },
    "required": ["query"]
  }
}
```

### LLM Parameter Override

The LLM can override these parameters per query while admin config serves as defaults:

| Parameter | Admin Config | LLM Override | Resolution |
|-----------|--------------|--------------|------------|
| `max_results` | Default limit | Per-query limit | LLM override if provided, else admin default |
| `search_depth` | Default depth | Per-query depth | LLM override if provided, else admin default |
| `include_answer` | Default mode | Per-query mode | LLM override if provided, else admin default |

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

## Data Source Tool

### Purpose

Enables the AI to query external data sources (APIs and CSV files) configured by administrators. Provides structured data retrieval with filtering, sorting, aggregation, and automatic visualization capabilities. Data sources are linked to categories for access control.

### Features

- **API Data Sources**: Connect to external REST APIs with authentication support
- **CSV Data Sources**: Upload and query CSV files with automatic column type inference
- **Category-Based Access**: Data sources are linked to categories; users only see sources for their accessible categories
- **Server-Side Aggregation**: Group, count, sum, average operations for large datasets
- **Automatic Visualization**: Smart chart type recommendation based on data characteristics
- **Caching**: Redis-based caching for API responses

### Supported Visualization Types

| Chart Type | Best For | Auto-Selection Criteria |
|------------|----------|------------------------|
| **bar** | Category comparisons | Default for categorical data |
| **line** | Time series data | Date/time fields detected |
| **pie** | Part-to-whole relationships | 2-8 categories with numeric values |
| **area** | Cumulative values over time | Similar to line but with volume emphasis |
| **scatter** | Correlation between variables | 2+ numeric fields, 30+ data points |
| **radar** | Multi-dimensional comparison | 3+ numeric fields, ≤10 records |
| **table** | Raw data display | Single records or aggregate results |

### Configuration

```typescript
interface DataSourceConfig {
  cacheTTLSeconds: number;      // 60-86400, default: 3600 (1 hour)
  timeout: number;              // 5-120 seconds, default: 30
  defaultLimit: number;         // 1-200 records, default: 30
  maxLimit: number;             // 1-500 records, default: 200
  defaultChartType: ChartType;  // default: 'bar'
  enabledChartTypes: ChartType[];  // default: all types
}
```

### Default Configuration

```json
{
  "enabled": true,
  "config": {
    "cacheTTLSeconds": 3600,
    "timeout": 30,
    "defaultLimit": 30,
    "maxLimit": 200,
    "defaultChartType": "bar",
    "enabledChartTypes": ["bar", "line", "pie", "area", "scatter", "radar", "table"]
  }
}
```

### OpenAI Function Schema

```json
{
  "name": "data_source",
  "description": "Query external data sources (APIs and CSV files) to retrieve structured data.",
  "parameters": {
    "type": "object",
    "properties": {
      "source_name": {
        "type": "string",
        "description": "Name of the data source to query"
      },
      "parameters": {
        "type": "object",
        "description": "Parameters to pass to API sources"
      },
      "filters": {
        "type": "array",
        "description": "Filter conditions (field, operator, value)",
        "items": {
          "type": "object",
          "properties": {
            "field": { "type": "string" },
            "operator": { "type": "string", "enum": ["eq", "ne", "gt", "lt", "gte", "lte", "contains", "in"] },
            "value": {}
          }
        }
      },
      "sort": {
        "type": "object",
        "properties": {
          "field": { "type": "string" },
          "direction": { "type": "string", "enum": ["asc", "desc"] }
        }
      },
      "limit": { "type": "number" },
      "offset": { "type": "number" },
      "visualization": {
        "type": "object",
        "properties": {
          "chart_type": { "type": "string", "enum": ["bar", "line", "pie", "area", "scatter", "radar", "table"] },
          "x_field": { "type": "string" },
          "y_field": { "type": "string" },
          "group_by": { "type": "string" }
        }
      },
      "aggregation": {
        "type": "object",
        "description": "Server-side aggregation for large datasets",
        "properties": {
          "group_by": {
            "oneOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }],
            "description": "Field(s) to group by. Use array for multi-dimensional grouping."
          },
          "metrics": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "field": { "type": "string" },
                "operation": { "type": "string", "enum": ["count", "sum", "avg", "min", "max"] }
              }
            }
          }
        }
      }
    },
    "required": ["source_name"]
  }
}
```

### Data Source Types

#### API Data Sources

External REST APIs with configurable authentication, parameters, and response mapping.

```typescript
interface DataAPIConfig {
  id: string;
  name: string;                    // Unique display name
  description: string;
  endpoint: string;                // Full API endpoint URL
  method: 'GET' | 'POST';
  responseFormat: 'json' | 'csv';
  authentication: {
    type: 'none' | 'bearer' | 'api_key' | 'basic';
    credentials?: {
      token?: string;              // For bearer auth
      apiKey?: string;             // For api_key auth
      apiKeyHeader?: string;       // Header name (default: X-API-Key)
      apiKeyLocation?: 'header' | 'query';
      username?: string;           // For basic auth
      password?: string;
    };
  };
  headers?: Record<string, string>;
  parameters: DataAPIParameter[];  // Parameter definitions
  responseStructure: {
    jsonPath: string;              // Path to data array (e.g., "data.results")
    dataIsArray: boolean;
    fields: ResponseField[];       // Field definitions with types
    totalCountPath?: string;       // For pagination
  };
  sampleResponse?: object;         // Sample for LLM context
  openApiSpec?: object;            // Original spec if imported
  configMethod: 'manual' | 'openapi';
  categoryIds: number[];           // Categories with access
  status: 'active' | 'inactive' | 'error' | 'untested';
}
```

#### CSV Data Sources

Uploaded CSV files with automatic column inference and in-memory querying.

```typescript
interface DataCSVConfig {
  id: string;
  name: string;                    // Unique display name
  description: string;
  filePath: string;                // Server storage path
  originalFilename: string;
  columns: {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date';
    description: string;
    format?: string;               // e.g., 'currency', 'percentage'
  }[];
  sampleData: object[];            // First 5 rows for preview
  rowCount: number;
  fileSize: number;                // In bytes
  categoryIds: number[];           // Categories with access
}
```

### Response Format

```typescript
interface DataQueryResponse {
  success: boolean;
  data: Record<string, unknown>[] | null;
  metadata: {
    source: string;
    sourceType: 'api' | 'csv';
    fetchedAt: string;
    cached: boolean;
    recordCount: number;
    totalRecords?: number;
    fields: string[];
    executionTimeMs: number;
  };
  visualizationHint?: {
    chartType: ChartType;
    xField?: string;
    yField?: string;
    groupBy?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}
```

### Example Usage

**User:** "Show me the survey responses by region"

**AI calls data_source tool:**
```json
{
  "source_name": "Survey Data",
  "aggregation": {
    "group_by": "region",
    "metrics": [{ "field": "id", "operation": "count" }]
  }
}
```

**Response includes:**
- Aggregated data grouped by region with counts
- Auto-selected visualization hint (pie chart for categorical data)
- The frontend automatically renders an interactive chart

---

## Chart Generator Tool

### Purpose

Enables the AI to generate interactive charts from data it constructs itself (from knowledge base, web search results, or reasoning/analysis). Unlike the Data Source tool which queries pre-configured data sources, Chart Generator allows the LLM to build and visualize ad-hoc datasets.

### When to Use

| Use Case | Example |
|----------|---------|
| **Synthesized data** | "Chart the top SOEs in Trinidad by fiscal risk" |
| **Comparative analysis** | "Show a bar chart comparing GDP growth across Caribbean nations" |
| **Aggregated research** | "Visualize the distribution of policy violations by department" |

### When NOT to Use

- When a configured `data_source` can provide the data (use that instead)
- For simple lists or tables (use markdown formatting)
- When data exceeds 500 rows

### Configuration

```typescript
interface ChartGenConfig {
  maxDataRows: number;           // 10-1000, default: 500
  defaultChartType: ChartType;   // Fallback when auto-detection is unclear
  enabledChartTypes: ChartType[]; // Available chart types
}
```

### Default Configuration

```json
{
  "enabled": true,
  "config": {
    "maxDataRows": 500,
    "defaultChartType": "bar",
    "enabledChartTypes": ["bar", "line", "pie", "area", "scatter", "radar", "table"]
  }
}
```

### OpenAI Function Schema

```json
{
  "name": "chart_gen",
  "description": "Generate an interactive chart from structured data you have constructed.",
  "parameters": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "Descriptive chart title (e.g., 'Trinidad & Tobago SOEs - Fiscal Risk Assessment 2024')"
      },
      "data": {
        "type": "array",
        "items": { "type": "object" },
        "description": "Array of data objects with consistent keys. Maximum 500 rows."
      },
      "x_field": {
        "type": "string",
        "description": "Field name for X-axis (categories/labels). Must exist in data objects."
      },
      "y_fields": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Field name(s) for Y-axis values. Multiple fields create grouped/stacked charts."
      },
      "recommended_chart": {
        "type": "string",
        "enum": ["bar", "line", "pie", "area", "scatter", "radar", "table", "auto"],
        "description": "Recommended chart type. Use 'auto' to let system decide."
      },
      "series_mode": {
        "type": "string",
        "enum": ["grouped", "stacked", "auto"],
        "description": "How to display multiple y_fields: grouped (side-by-side) or stacked."
      },
      "notes": {
        "type": "string",
        "description": "Optional notes about data sources, methodology, or caveats."
      }
    },
    "required": ["title", "data", "x_field", "y_fields"]
  }
}
```

### Chart Type Auto-Selection

When `recommended_chart` is set to `auto`, the system selects based on data characteristics:

| Criteria | Selected Chart |
|----------|----------------|
| Multiple y_fields | Bar (grouped/stacked) |
| Date/time x_field | Line |
| 2-8 categories, ≤20 rows | Pie |
| 3+ metrics, ≤10 rows | Radar |
| Categorical x_field | Bar |
| Fallback | Default from config |

### Response Format

```typescript
interface ChartGenResponse {
  success: boolean;
  data: Record<string, unknown>[];
  metadata: {
    source: "LLM Generated";
    sourceType: "chart_gen";
    recordCount: number;
    fields: string[];
    executionTimeMs: number;
    cached: false;
  };
  visualizationHint: {
    chartType: ChartType;
    xField: string;
    yField: string;
  };
  chartTitle: string;
  notes?: string;
  seriesMode?: "grouped" | "stacked" | "auto";
}
```

### Notes Display

Notes are displayed in a collapsible accordion below the chart, allowing users to see data provenance, methodology, or caveats without cluttering the visualization.

### Example Usage

**User:** "Create a chart showing the top 5 Caribbean countries by GDP"

**AI calls chart_gen tool:**
```json
{
  "title": "Top 5 Caribbean Countries by GDP (2024)",
  "data": [
    {"country": "Trinidad & Tobago", "gdp_billions": 28.1},
    {"country": "Jamaica", "gdp_billions": 17.1},
    {"country": "Bahamas", "gdp_billions": 14.3},
    {"country": "Barbados", "gdp_billions": 5.6},
    {"country": "Suriname", "gdp_billions": 3.8}
  ],
  "x_field": "country",
  "y_fields": ["gdp_billions"],
  "recommended_chart": "bar",
  "notes": "Data sourced from IMF World Economic Outlook, October 2024. GDP in current USD billions."
}
```

**Result:** Interactive bar chart with country names on X-axis, GDP values on Y-axis, and collapsible notes section showing data source attribution.

---

## Function API Tool

### Purpose

Enables dynamic function calling with OpenAI-format tool schemas. Administrators configure external APIs with explicit function definitions that the LLM can invoke directly. Unlike the Data Source tool which focuses on data retrieval, Function API supports arbitrary API operations (GET, POST, PUT, DELETE) with structured input/output schemas.

### Features

- **OpenAI-Format Schemas**: Use standard OpenAI tool definition format
- **Multiple Functions Per API**: Define multiple operations for a single API
- **Category-Based Access**: Functions are linked to categories
- **Automatic Injection**: Functions are dynamically added to LLM tool list based on category context
- **Authentication Support**: API key, Bearer token, Basic auth
- **Response Caching**: Configurable TTL for repeated queries

### Configuration

Function API configurations store:

```typescript
interface FunctionAPIConfig {
  id: string;
  name: string;                    // Display name (e.g., "GEA Analytics API")
  description: string;

  // API Connection
  baseUrl: string;                 // Base URL (e.g., "https://api.example.com")
  authType: 'api_key' | 'bearer' | 'basic' | 'none';
  authHeader?: string;             // Header name (e.g., "X-API-Key")
  authCredentials?: string;        // Encrypted credentials
  defaultHeaders?: Record<string, string>;

  // Function Definitions (OpenAI format)
  toolsSchema: OpenAI.Chat.ChatCompletionTool[];

  // Endpoint Mappings
  endpointMappings: Record<string, {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;                  // Relative path (e.g., "/feedback")
  }>;

  // Settings
  timeoutSeconds: number;          // Default: 30
  cacheTTLSeconds: number;         // Default: 3600
  isEnabled: boolean;
  status: 'active' | 'inactive' | 'error' | 'untested';

  // Access Control
  categoryIds: number[];
}
```

### OpenAI Tool Schema Format

Each function is defined using the standard OpenAI tool format:

```json
{
  "type": "function",
  "function": {
    "name": "submit_feedback",
    "description": "Submit user feedback to the analytics system",
    "parameters": {
      "type": "object",
      "properties": {
        "user_id": {
          "type": "string",
          "description": "The user's unique identifier"
        },
        "rating": {
          "type": "integer",
          "description": "Rating from 1-5"
        },
        "comment": {
          "type": "string",
          "description": "Optional feedback comment"
        }
      },
      "required": ["user_id", "rating"]
    }
  }
}
```

### Endpoint Mapping

Each function name maps to an HTTP endpoint:

```json
{
  "submit_feedback": {
    "method": "POST",
    "path": "/feedback"
  },
  "get_user_stats": {
    "method": "GET",
    "path": "/users/stats"
  }
}
```

### Response Format

```typescript
interface FunctionExecutionResult {
  success: boolean;
  data?: unknown;                  // API response data
  metadata?: {
    source: string;                // Config name
    functionName: string;          // Function that was called
    executionTimeMs: number;
    cached: boolean;
  };
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}
```

### How It Works

1. **Admin Configuration**: Admin creates Function API config with tool schemas and endpoint mappings
2. **Category Assignment**: Functions are linked to specific categories
3. **Dynamic Injection**: When a user queries in a category, associated functions are added to the LLM's available tools
4. **LLM Invocation**: LLM decides when to call functions based on user intent
5. **Execution**: System maps function call to HTTP endpoint, executes, and returns result
6. **Response**: LLM uses the function result to generate the final response

### Example Configuration

```json
{
  "name": "Customer Feedback API",
  "baseUrl": "https://api.feedback.example.com",
  "authType": "api_key",
  "authHeader": "X-API-Key",
  "toolsSchema": [
    {
      "type": "function",
      "function": {
        "name": "get_feedback_summary",
        "description": "Get aggregated feedback statistics for a time period",
        "parameters": {
          "type": "object",
          "properties": {
            "start_date": { "type": "string", "format": "date" },
            "end_date": { "type": "string", "format": "date" },
            "category": { "type": "string" }
          },
          "required": ["start_date", "end_date"]
        }
      }
    }
  ],
  "endpointMappings": {
    "get_feedback_summary": {
      "method": "GET",
      "path": "/summary"
    }
  },
  "categoryIds": [1, 2]
}
```

---

## Task Planner Tool

### Purpose

Enables the AI to create and manage multi-step task plans for complex operations that require sequential work, progress tracking, and structured execution. This tool is ideal for assessments, research projects, and any multi-phase workflow.

### When to Use

| Use Case | Example |
|----------|---------|
| **Multi-entity assessments** | "Assess all SOEs in Trinidad" |
| **Sequential operations** | "Evaluate WASA's financial health using the 6-dimension framework" |
| **Complex analysis** | "Conduct a comprehensive policy review for the energy sector" |

### When NOT to Use

- Simple factual questions ("What is the debt of WASA?")
- Single-step lookups that can be answered with one web search
- Questions that don't require progress tracking

### Features

- **Template-based creation**: Use predefined templates configured per category
- **Custom task lists**: Create ad-hoc plans with explicit title and tasks
- **Placeholder substitution**: Templates support `{variable}` placeholders
- **Progress tracking**: Track task status (pending, in_progress, completed, failed, skipped)
- **Database persistence**: Plans are stored and can be resumed

### Configuration

Task Planner has minimal global configuration. Templates are configured per category.

```typescript
interface TaskPlannerConfig {
  // Currently no global settings - templates defined per category
}
```

### Default Configuration

```json
{
  "enabled": true,
  "config": {}
}
```

### Category Templates

Templates are defined in `category_tool_configs.config_json` for each category:

```typescript
interface TaskPlannerCategoryConfig {
  templates?: {
    [templateKey: string]: {
      name: string;             // Display name for LLM
      description: string;      // When to use this template
      active: boolean;          // Whether available for use
      placeholders: string[];   // Variables like ["country", "soe_name"]
      tasks: Array<{
        id: number;
        description: string;    // Can include {placeholders}
      }>;
      createdBy?: string;
      updatedBy?: string;
      updatedAt?: string;
    };
  };
}
```

### Example Template Configuration

```json
{
  "templates": {
    "country_assessment": {
      "name": "Country SOE Assessment",
      "description": "Assess all SOEs in a country",
      "active": true,
      "placeholders": ["country"],
      "tasks": [
        { "id": 1, "description": "Identify major SOEs in {country}" },
        { "id": 2, "description": "Search fiscal impact data (2020-2024)" },
        { "id": 3, "description": "Apply Pareto filter - top 20% by impact" },
        { "id": 4, "description": "Confirm priority SOEs with user" },
        { "id": 5, "description": "Assess SOEs using 6-dimension framework" },
        { "id": 6, "description": "Generate consolidated report" }
      ]
    }
  }
}
```

### OpenAI Function Schema

```json
{
  "name": "task_planner",
  "description": "Create and manage multi-step task plans for complex operations.",
  "parameters": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["create", "start_task", "complete_task", "fail_task", "skip_task", "get_status", "complete_plan", "cancel_plan"],
        "description": "Action to perform on the task plan"
      },
      "template": {
        "type": "string",
        "description": "Template name from category config (for create action)"
      },
      "template_variables": {
        "type": "object",
        "additionalProperties": { "type": "string" },
        "description": "Placeholder values for template (e.g., {\"country\": \"Jamaica\"})"
      },
      "title": {
        "type": "string",
        "description": "Plan title (required for create if no template)"
      },
      "tasks": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "number" },
            "description": { "type": "string" }
          },
          "required": ["id", "description"]
        },
        "description": "List of tasks (required for create if no template)"
      },
      "plan_id": {
        "type": "string",
        "description": "Plan ID (required for all actions except create)"
      },
      "task_id": {
        "type": "number",
        "description": "Task ID to update (for task actions)"
      },
      "result": {
        "type": "string",
        "description": "Result summary (for complete_task)"
      },
      "error": {
        "type": "string",
        "description": "Error description (for fail_task)"
      },
      "reason": {
        "type": "string",
        "description": "Skip reason (for skip_task)"
      },
      "summary": {
        "type": "string",
        "description": "Overall summary (for complete_plan)"
      }
    },
    "required": ["action"]
  }
}
```

### Task States

| State | Description |
|-------|-------------|
| `pending` | Task not yet started |
| `in_progress` | Currently being worked on |
| `completed` | Successfully completed with result |
| `failed` | Failed with error message |
| `skipped` | Skipped with reason |

### Plan States

| State | Description |
|-------|-------------|
| `active` | Plan in progress |
| `completed` | All tasks finished successfully |
| `cancelled` | Plan cancelled by user/LLM |
| `failed` | Plan failed (critical task failed) |

### Admin UI

Templates are managed in the Admin Dashboard under **Tools > Task Planner**:

1. **Select category** - Choose which category to configure
2. **View templates** - List of defined templates with status
3. **Create template** - Define new template with tasks and placeholders
4. **Edit template** - Modify template details, tasks, placeholders
5. **Activate/Deactivate** - Toggle template availability (Admin only can deactivate)
6. **Delete template** - Remove template (Admin only)

### Permission Model

| Role | Capabilities |
|------|-------------|
| **Admin** | Full control: add, edit, deactivate, delete templates for any category |
| **Superuser** | Can add and edit templates for their assigned categories only |

### Example Usage

**User:** "Assess all SOEs in Jamaica"

**AI calls task_planner with template:**
```json
{
  "action": "create",
  "template": "country_assessment",
  "template_variables": { "country": "Jamaica" }
}
```

**AI calls task_planner with custom tasks:**
```json
{
  "action": "create",
  "title": "Jamaica SOE Assessment",
  "tasks": [
    { "id": 1, "description": "Identify major SOEs in Jamaica" },
    { "id": 2, "description": "Research fiscal data for 2020-2024" },
    { "id": 3, "description": "Apply Pareto filter" }
  ]
}
```

**Progress update:**
```json
{
  "action": "complete_task",
  "plan_id": "abc-123",
  "task_id": 1,
  "result": "Identified 15 major SOEs including JUTC, NWC, and Petrojam"
}
```

---

## YouTube Tool

### Purpose

Enables the AI to extract transcripts from YouTube videos for analysis, summarization, or reference.

### Features

- **Transcript extraction**: Get full video transcripts
- **Language support**: Preferred language configurable
- **Fallback mechanism**: Uses youtube-transcript npm package if API unavailable

### Configuration

```typescript
interface YouTubeConfig {
  apiKey: string;              // YouTube Data API key (optional)
  preferredLanguage: string;   // Default: 'en'
  fallbackEnabled: boolean;    // Allow npm fallback, default: true
}
```

### Default Configuration

```json
{
  "enabled": false,
  "config": {
    "apiKey": "",
    "preferredLanguage": "en",
    "fallbackEnabled": true
  }
}
```

### OpenAI Function Schema

```json
{
  "name": "youtube",
  "description": "Extract transcript from a YouTube video for analysis or summarization.",
  "parameters": {
    "type": "object",
    "properties": {
      "video_url": {
        "type": "string",
        "description": "YouTube video URL or video ID"
      },
      "language": {
        "type": "string",
        "description": "Preferred language code (e.g., 'en', 'es')"
      }
    },
    "required": ["video_url"]
  }
}
```

### Example Usage

**User:** "Summarize this video: https://youtube.com/watch?v=xyz123"

**AI Response:**
> Based on the video transcript, here are the key points:
>
> 1. Introduction to policy framework
> 2. Implementation challenges
> 3. Recommended solutions
>
> Source: YouTube video "Policy Implementation Guide"

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

Superusers and Admins can configure tool settings per category.

### Use Cases

- Different branding per category (e.g., different logos for different departments)
- Enable/disable tools for specific categories
- Custom domain filters for web search per category
- **Tool-specific configurations** (e.g., Task Planner templates per category)

### Database Schema

```sql
CREATE TABLE category_tool_configs (
  id TEXT PRIMARY KEY,
  category_id INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  is_enabled INTEGER,         -- null = inherit from global
  branding_json TEXT,         -- Category-specific branding
  config_json TEXT,           -- Tool-specific config overrides (e.g., templates)
  created_at DATETIME,
  updated_at DATETIME,
  updated_by TEXT NOT NULL,
  UNIQUE(category_id, tool_name)
);
```

### Config Field

The `config_json` column stores tool-specific configuration overrides as JSON. This is used for:

| Tool | Config Content |
|------|----------------|
| `task_planner` | Templates with placeholders and task lists |
| `web_search` | Category-specific domain filters |
| `doc_gen` | Category-specific branding overrides |

### Override Resolution

```typescript
function getEffectiveToolConfig(toolName: string, categoryId: number) {
  const categoryOverride = getCategoryToolConfig(categoryId, toolName);
  const globalConfig = getToolConfig(toolName);

  // Enabled: category override takes precedence
  let enabled = globalConfig?.isEnabled ?? false;
  if (categoryOverride?.isEnabled !== null && categoryOverride?.isEnabled !== undefined) {
    enabled = categoryOverride.isEnabled;
  }

  // Branding: category override takes precedence
  let branding = globalConfig?.config?.branding ?? null;
  if (categoryOverride?.branding) {
    branding = categoryOverride.branding;
  }

  // Config: deep merge global + category override
  let config = globalConfig?.config ? { ...globalConfig.config } : null;
  if (categoryOverride?.config) {
    config = { ...(config || {}), ...categoryOverride.config };
  }

  return { enabled, branding, config, globalConfig, categoryOverride };
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

### Task Planner Template Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/tools/task-planner/templates?categoryId=X` | List templates for category |
| POST | `/api/admin/tools/task-planner/templates` | Create new template |
| GET | `/api/admin/tools/task-planner/templates/{key}?categoryId=X` | Get specific template |
| PATCH | `/api/admin/tools/task-planner/templates/{key}` | Update template |
| DELETE | `/api/admin/tools/task-planner/templates/{key}?categoryId=X` | Delete template (Admin only) |

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
| `src/lib/tools/data-source.ts` | Data source tool implementation |
| `src/lib/tools/chart-gen.ts` | Chart generator tool implementation |
| `src/lib/tools/function-api.ts` | Function API tool implementation |
| `src/lib/docgen/pdf-builder.ts` | PDF generation |
| `src/lib/docgen/docx-builder.ts` | DOCX generation |
| `src/lib/docgen/md-builder.ts` | Markdown generation |
| `src/lib/docgen/branding.ts` | Branding configuration |
| `src/lib/data-sources/api-caller.ts` | External API request handling |
| `src/lib/data-sources/csv-handler.ts` | CSV file querying |
| `src/lib/data-sources/aggregation.ts` | Data aggregation operations |
| `src/lib/db/tool-config.ts` | Database operations |
| `src/lib/db/data-sources.ts` | Data source CRUD operations |
| `src/lib/db/function-api-config.ts` | Function API CRUD operations |
| `src/lib/db/category-tool-config.ts` | Category overrides |
| `src/types/data-sources.ts` | Data source type definitions |
| `src/types/chart-gen.ts` | Chart generator type definitions |
| `src/types/function-api.ts` | Function API type definitions |
