# Bot Configuration Architecture

This document describes the key configuration components that control how the AI assistant behaves and responds to users.

---

## Table of Contents

1. [System Prompt (Global Prompt)](#1-system-prompt-global-prompt)
2. [Starter Prompts](#2-starter-prompts)
3. [Category Prompts](#3-category-prompts)
4. [Skills](#4-skills)
5. [Tools](#5-tools)
6. [Memory](#6-memory)
7. [Prompt Assembly Flow](#7-prompt-assembly-flow)
8. [Comparison Table](#8-comparison-table)

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
| **Autonomous** | LLM-triggered via OpenAI function calling | `web_search` |
| **Processor** | Post-response output processors | `doc_gen`, `data_viz` |

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

#### Data Visualization (`data_viz`) - Processor
```typescript
{
  enabled: true,
  config: {
    defaultChartType: 'bar',
    enabledChartTypes: ['bar', 'line', 'pie', 'area'],
    maxDataPoints: 1000
  }
}
```

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

## 6. Memory

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

## 7. Prompt Assembly Flow

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
│ 7. → Sent to OpenAI with Tool Definitions                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Comparison Table

| Aspect | System Prompt | Category Prompt | Starter Prompts | Skills | Tools | Memory |
|--------|--------------|-----------------|-----------------|--------|-------|--------|
| **Purpose** | Global AI behavior | Category-specific tuning | Quick conversation starters | Modular expertise injection | Extended capabilities | Conversation context |
| **Scope** | All conversations | Per-category | Per-category | Per-trigger (always/category/keyword) | Global + per-category | Per-thread |
| **User-facing?** | No | No | Yes (buttons) | No | Visible (outputs) | No |
| **Configured by** | Admin | Admin/Superuser | Admin/Superuser | Admin | Admin | System |
| **Storage** | `settings` table | `category_prompts` | `category_prompts` | `skills` table | `tool_configs` | `messages` table |
| **Max length** | ~8000 chars (combined) | Remaining budget | 500 chars/prompt | Token budget | N/A | Message window |

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
