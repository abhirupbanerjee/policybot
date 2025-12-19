# Bot Configuration Architecture

This document describes the key configuration components that control how the AI assistant behaves and responds to users.

---

## Table of Contents

1. [System Prompt (Global Prompt)](#1-system-prompt-global-prompt)
2. [Starter Prompts](#2-starter-prompts)
3. [Category Prompts](#3-category-prompts)
4. [Skills](#4-skills)
5. [Tools](#5-tools)
6. [Data Sources](#6-data-sources)
7. [Function APIs](#7-function-apis)
8. [Memory](#8-memory)
9. [Prompt Assembly Flow](#9-prompt-assembly-flow)
10. [Comparison Table](#10-comparison-table)

---

## 1. System Prompt (Global Prompt)

**What it is:** The foundational instructions sent to the AI for every conversation. Defines core behavior, constraints, and response guidelines.

### Storage
- **Primary:** SQLite `settings` table with key `'system-prompt'`
- **Fallback:** `config/system-prompt.md` file (loaded if SQLite value is missing/outdated)

### Key Features
- Auto-sync: When `system-prompt.md` file changes (detected via hash), SQLite entry is cleared and new file content is used
- Maximum combined length with category addendum: **8,000 characters**
- Admin-only access via `/api/admin/system-prompt`

### Example
```markdown
You are an AI assistant for government policy guidance.
Always cite sources when referencing policies.
Maintain a professional, helpful tone.
```

---

## 2. Starter Prompts

**What it is:** Quick-start buttons displayed in the UI for category-specific conversations. Pre-written prompt templates users can click to initiate conversations quickly.

### Storage
- **Table:** `category_prompts.starter_prompts` (JSON stored as TEXT)
- Linked to specific categories

### Structure
```typescript
interface StarterPrompt {
  label: string;   // Button text (max 30 chars)
  prompt: string;  // Full message to send (max 500 chars)
}
```

### Constraints
| Constraint | Value |
|------------|-------|
| Max starters per category | 6 |
| Max label length | 30 characters |
| Max prompt length | 500 characters |

### Example
| Label | Prompt |
|-------|--------|
| "Leave Policy" | "What is the annual leave entitlement for permanent employees?" |
| "Travel Allowance" | "Explain the travel allowance policy for interstate travel" |

---

## 3. Category Prompts

**What it is:** Category-specific addendum to the global system prompt. Fine-tunes AI behavior for different domains (e.g., Finance, HR, Operations).

### Storage
- **Table:** `category_prompts.prompt_addendum` (TEXT)
- One-to-one relationship with categories

### How It Combines
```
Final System Prompt = Global System Prompt
                    + "\n\n--- Category-Specific Guidelines ---\n\n"
                    + Category Addendum
```

### Character Budget
- Maximum combined length: **8,000 characters**
- Available for category = `8000 - global_prompt_length - separator_length`

### Security
Forbidden phrases are blocked to prevent prompt injection:
- `ignore previous`, `disregard`, `system:`, `assistant:`
- `ignore above`, `forget all`, `new instructions`, `override`

### Permissions
| Role | Access |
|------|--------|
| Admin | Edit all categories |
| Superuser | Edit assigned categories only |
| Regular user | No access |

---

## 4. Skills

**What it is:** Modular, reusable prompt components dynamically injected into the system prompt based on context. Skills encapsulate domain expertise that can be selectively applied.

### Storage
- **Table:** `skills` - Main skill definitions
- **Table:** `category_skills` - Many-to-many linking skills to categories
- **Settings:** `settings['skills-settings']` - Global enable flag and token budget

### Skill Types (by Trigger)

#### Type 1: Always Skills (`trigger_type = 'always'`)
- Activated for **every conversation**
- No additional context needed
- Example: Legal compliance guidelines, core formatting rules

#### Type 2: Category Skills (`trigger_type = 'category'`)
- Activated when **specific categories are selected**
- Linked via `category_skills` table
- Can be marked as **index skills** (`is_index = true`) for broader domain expertise
- Example: Financial reporting rules for Finance category

#### Type 3: Keyword Skills (`trigger_type = 'keyword'`)
- Activated when **user message contains specific keywords**
- `trigger_value` stores comma-separated keywords (e.g., `"budget,spending,cost"`)
- Optional `category_restricted` flag:
  - `true` = Only applies if user's selected category is linked
  - `false` = Applies globally when keywords match
- Example: Accounting guidance triggered by "accounting" keyword

### Skill Structure
```typescript
interface Skill {
  id: number;
  name: string;
  description: string | null;
  prompt_content: string;        // The actual skill prompt text
  trigger_type: 'always' | 'category' | 'keyword';
  trigger_value: string | null;  // Keywords for keyword-type skills
  category_restricted: boolean;  // Restrict to linked categories
  is_index: boolean;             // Broader domain expertise flag
  priority: number;              // Lower = higher priority
  is_active: boolean;
  is_core: boolean;              // Core skills cannot be deleted
  token_estimate: number;        // ~1 token per 4 chars
}
```

### Skill Resolution Process
```
1. Get all "always" skills → Add to activated list
2. Get category index skills for selected categories → Add to activated
3. For each keyword skill:
   - Check if keywords match user message
   - If category_restricted, verify category is linked
   - If matches, add to activated
4. Sort by priority (lower = higher)
5. Add skills respecting token budget
6. Combine all activated skill prompts
```

### Configuration
```typescript
interface SkillsSettings {
  enabled: boolean;        // Master on/off
  maxTotalTokens: number;  // Budget for all skills (default: 3000)
  debugMode: boolean;      // Logs activation details
}
```

### Core Skills
- Loaded from `config/skills.json` manifest and `config/skills/*.md` files
- Seeded on startup, marked with `is_core = true`
- Cannot be deleted, but can be reset to defaults

---

## 5. Tools

**What it is:** Capabilities that extend the AI beyond text generation. Tools can perform web searches, generate documents, create visualizations, etc.

### Tool Categories

| Category | Description | Example |
|----------|-------------|---------|
| **Autonomous** | LLM-triggered via OpenAI function calling | `web_search`, `data_source`, `function_api` |
| **Processor** | Post-response output processors | `doc_gen` |

### Storage
- **Table:** `tool_configs` - Global tool configurations
- **Table:** `category_tool_configs` - Category-level overrides
- **Table:** `tool_config_audit` - Audit trail of changes

### Available Tools

#### Web Search (`web_search`) - Autonomous
```typescript
{
  enabled: false,  // Requires API key
  config: {
    apiKey: string,
    defaultTopic: 'general' | 'news' | 'finance',
    defaultSearchDepth: 'basic' | 'advanced',
    maxResults: 5,
    includeDomains: string[],
    excludeDomains: string[],
    cacheTTLSeconds: 3600
  }
}
```

#### Document Generator (`doc_gen`) - Processor
```typescript
{
  enabled: true,
  config: {
    defaultFormat: 'pdf',
    enabledFormats: ['pdf', 'docx', 'md'],
    branding: { /* logo, colors, etc */ },
    expirationDays: 30
  }
}
```

#### Data Source (`data_source`) - Autonomous
```typescript
{
  enabled: true,
  config: {
    cacheTTLSeconds: 3600,
    timeout: 30,
    defaultLimit: 30,
    maxLimit: 200,
    defaultChartType: 'bar',
    enabledChartTypes: ['bar', 'line', 'pie', 'area', 'scatter', 'radar', 'table']
  }
}
```
- Queries external APIs and CSV data sources
- Category-based access control
- Supports filtering, sorting, aggregation
- Automatic visualization recommendations
- See [Data Sources](#6-data-sources) for full details

#### Function API (`function_api`) - Autonomous
```typescript
{
  enabled: true,
  config: {
    globalEnabled: true
  }
}
```
- Dynamic function calling with OpenAI-format schemas
- Admin-configured external API endpoints
- Category-based access control
- See [Function APIs](#7-function-apis) for full details

### Category Overrides
- Tools can have category-specific configurations
- Category override takes precedence if set
- Falls back to global config if category override is null
- Useful for custom branding per category

### Autonomous Tool Execution Flow
```
1. OpenAI receives enabled tool definitions
2. LLM decides to call tool → returns tool_call with args
3. Backend executes tool
4. Tool result returned to LLM
5. LLM generates final response using tool results
```

---

## 6. Data Sources

**What it is:** External data connections (APIs and CSV files) that the AI can query to retrieve structured information. Data sources are linked to categories for access control.

### Storage
- **Table:** `data_api_configs` - API data source configurations
- **Table:** `data_csv_configs` - CSV data source configurations
- **Table:** `data_api_categories` - Links APIs to categories
- **Table:** `data_csv_categories` - Links CSVs to categories
- **Table:** `data_source_audit` - Audit trail of changes

### Data Source Types

#### API Data Sources
External REST APIs with configurable authentication and response mapping.

```typescript
interface DataAPIConfig {
  id: string;
  name: string;
  description: string;
  endpoint: string;                          // Full API URL
  method: 'GET' | 'POST';
  responseFormat: 'json' | 'csv';
  authentication: {
    type: 'none' | 'bearer' | 'api_key' | 'basic';
    credentials?: { /* encrypted */ };
  };
  parameters: DataAPIParameter[];            // Parameter definitions
  responseStructure: {
    jsonPath: string;                        // Path to data array
    fields: ResponseField[];                 // Field type definitions
  };
  categoryIds: number[];                     // Linked categories
  status: 'active' | 'inactive' | 'error' | 'untested';
}
```

#### CSV Data Sources
Uploaded CSV files stored on the server with automatic column inference.

```typescript
interface DataCSVConfig {
  id: string;
  name: string;
  description: string;
  filePath: string;                          // Server storage path
  columns: CSVColumn[];                      // Column definitions
  rowCount: number;
  categoryIds: number[];                     // Linked categories
}
```

### Query Capabilities

| Feature | Description |
|---------|-------------|
| **Filtering** | Field-based filters: eq, ne, gt, lt, gte, lte, contains, in |
| **Sorting** | Sort by any field, ascending or descending |
| **Pagination** | Limit and offset for large datasets |
| **Aggregation** | Server-side group_by with count/sum/avg/min/max |
| **Multi-dimensional grouping** | Group by multiple fields for cross-tabulation |

### Visualization

Data source responses include automatic visualization hints:
- **bar** - Default for categorical data
- **line** - Time series data
- **pie** - Part-to-whole (2-8 categories)
- **scatter** - Correlation analysis
- **radar** - Multi-metric comparison
- **table** - Raw data or single records

### Access Control
- Data sources are linked to categories
- Users can only query sources linked to their accessible categories
- Source availability is injected into the system prompt context

### Administration
```
Admin → Create API/CSV configs → Link to categories → Test connection → Activate
```

---

## 7. Function APIs

**What it is:** Dynamic function calling capability using OpenAI-format tool schemas. Administrators configure external APIs with explicit function definitions that the LLM can invoke directly.

### Key Difference from Data Sources
- **Data Sources**: Focus on data retrieval with querying/filtering
- **Function APIs**: Support arbitrary API operations (GET/POST/PUT/DELETE) with structured schemas

### Storage
- **Table:** `function_api_configs` - Function API configurations
- **Table:** `function_api_categories` - Links Function APIs to categories

### Configuration Structure

```typescript
interface FunctionAPIConfig {
  id: string;
  name: string;                              // Display name
  description: string;

  // API Connection
  baseUrl: string;                           // e.g., "https://api.example.com"
  authType: 'api_key' | 'bearer' | 'basic' | 'none';
  authHeader?: string;                       // e.g., "X-API-Key"
  authCredentials?: string;                  // Encrypted

  // Function Definitions (OpenAI format)
  toolsSchema: OpenAI.Chat.ChatCompletionTool[];

  // Endpoint Mappings
  endpointMappings: Record<string, {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;                            // Relative to baseUrl
  }>;

  // Settings
  timeoutSeconds: number;
  cacheTTLSeconds: number;
  isEnabled: boolean;
  status: 'active' | 'inactive' | 'error' | 'untested';

  // Access Control
  categoryIds: number[];
}
```

### OpenAI Tool Schema Format

Functions are defined using standard OpenAI tool format:

```json
{
  "type": "function",
  "function": {
    "name": "get_user_stats",
    "description": "Retrieve user statistics for a given time period",
    "parameters": {
      "type": "object",
      "properties": {
        "user_id": { "type": "string" },
        "start_date": { "type": "string", "format": "date" },
        "end_date": { "type": "string", "format": "date" }
      },
      "required": ["user_id"]
    }
  }
}
```

### Dynamic Injection Flow

```
1. User selects category or starts conversation
2. System fetches Function APIs linked to that category
3. Tool definitions are added to LLM's available functions
4. LLM decides when to call functions based on user intent
5. System maps function name → endpoint, executes HTTP request
6. Response returned to LLM for final answer generation
```

### Response Format

```typescript
interface FunctionExecutionResult {
  success: boolean;
  data?: unknown;                            // API response
  metadata?: {
    source: string;                          // Config name
    functionName: string;
    executionTimeMs: number;
    cached: boolean;
  };
  error?: { code: string; message: string; };
}
```

### Use Cases
- Submit feedback to external systems
- Retrieve analytics from business APIs
- Trigger workflows in external services
- Query specialized databases

---

## 8. Memory

**What it is:** Persistent conversation context that allows follow-up questions and maintains continuity within threads.

### Current Implementation
- **Storage:** SQLite `messages` table
- **Scope:** Per-thread conversation history
- **Limit:** Configurable message window (default: 5 messages)

### Example
```
User: "What is our leave policy?"
Bot: [responds with leave policy details]
User: "What about section 3?"  ← Bot understands context
```

### Planned Enhancements
- User-category-wise persistent memory
- Thread summarization for cost optimization
- Memory extraction for key facts across sessions

---

## 9. Prompt Assembly Flow

When a user sends a message, the complete prompt is assembled in this order:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Global System Prompt                                      │
│    (from settings or config/system-prompt.md)               │
├─────────────────────────────────────────────────────────────┤
│ 2. + Category Addendum (if category selected)               │
│    "--- Category-Specific Guidelines ---"                   │
├─────────────────────────────────────────────────────────────┤
│ 3. + Resolved Skills                                        │
│    - Always skills                                          │
│    - Category index skills                                  │
│    - Matching keyword skills                                │
├─────────────────────────────────────────────────────────────┤
│ 4. + Memory Context (if enabled)                            │
├─────────────────────────────────────────────────────────────┤
│ 5. + Thread Summary (if available)                          │
├─────────────────────────────────────────────────────────────┤
│ 6. + RAG Context (knowledge base documents)                 │
├─────────────────────────────────────────────────────────────┤
│ 7. + Available Data Sources (injected for LLM awareness)    │
├─────────────────────────────────────────────────────────────┤
│ 8. + Available Function APIs (injected as tool definitions) │
├─────────────────────────────────────────────────────────────┤
│ 9. → Sent to OpenAI with Tool Definitions                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Comparison Table

| Aspect | System Prompt | Category Prompt | Starter Prompts | Skills | Tools | Data Sources | Function APIs | Memory |
|--------|--------------|-----------------|-----------------|--------|-------|--------------|---------------|--------|
| **Purpose** | Global AI behavior | Category-specific tuning | Quick conversation starters | Modular expertise injection | Extended capabilities | External data querying | Dynamic function calling | Conversation context |
| **Scope** | All conversations | Per-category | Per-category | Per-trigger (always/category/keyword) | Global + per-category | Per-category | Per-category | Per-thread |
| **User-facing?** | No | No | Yes (buttons) | No | Visible (outputs) | Visible (charts/data) | Visible (results) | No |
| **Configured by** | Admin | Admin/Superuser | Admin/Superuser | Admin | Admin | Admin | Admin | System |
| **Storage** | `settings` table | `category_prompts` | `category_prompts` | `skills` table | `tool_configs` | `data_*_configs` | `function_api_configs` | `messages` table |
| **Max length** | ~8000 chars (combined) | Remaining budget | 500 chars/prompt | Token budget | N/A | Record limits | N/A | Message window |

---

## Database Schema Overview

```sql
-- Global settings (system prompt, skills config, etc.)
settings (key, value, updated_at, updated_by)

-- Category-specific prompts and starters
category_prompts (category_id, prompt_addendum, starter_prompts, ...)

-- Skills definitions
skills (id, name, prompt_content, trigger_type, trigger_value, ...)

-- Skills linked to categories
category_skills (category_id, skill_id)

-- Tool configurations
tool_configs (tool_name, is_enabled, config_json, ...)

-- Category-specific tool overrides
category_tool_configs (category_id, tool_name, is_enabled, branding_json, ...)

-- API Data Sources
data_api_configs (id, name, endpoint, authentication, parameters, response_structure, ...)

-- CSV Data Sources
data_csv_configs (id, name, file_path, columns, row_count, ...)

-- Data source to category mappings
data_api_categories (api_id, category_id)
data_csv_categories (csv_id, category_id)

-- Data source audit trail
data_source_audit (source_type, source_id, action, changed_by, ...)

-- Function API configurations
function_api_configs (id, name, base_url, auth_type, tools_schema, endpoint_mappings, ...)

-- Function API to category mappings
function_api_categories (api_id, category_id)
```

---

## Key Settings Table Entries

| Key | Purpose |
|-----|---------|
| `system-prompt` | Global AI instructions |
| `skills-settings` | Master enable + token budget |
| `llm-settings` | Model, temperature, max tokens |
| `rag-settings` | Retrieval parameters |
| `memory-settings` | User memory extraction |
| `summarization-settings` | Thread summarization |
