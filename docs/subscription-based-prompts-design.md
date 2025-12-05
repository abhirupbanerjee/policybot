# Subscription-Based System Prompts - Design Document

## Status: Draft - Pending Design Decisions

---

## 1. Current System Overview

### 1.1 User-Subscription Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER ROLES                                │
├─────────────────────────────────────────────────────────────────┤
│  Admin          │ Access to ALL categories                      │
│  Superuser      │ Access to ASSIGNED categories only            │
│  User           │ Access to SUBSCRIBED categories only          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    DATA MODEL                                    │
├─────────────────────────────────────────────────────────────────┤
│  users                    │ Core user table with roles          │
│  categories               │ Document categories (EA, DTA, etc.) │
│  user_subscriptions       │ User → Category subscriptions       │
│  super_user_categories    │ Superuser → Category assignments    │
│  thread_categories        │ Thread → Category associations      │
│  documents                │ Uploaded policy documents           │
│  document_categories      │ Document → Category mapping         │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Current System Prompt Behavior

- **Single global system prompt** stored in `settings` table
- Same prompt used for ALL users regardless of:
  - User role (admin/superuser/user)
  - Number of subscriptions
  - Thread category selection
- RAG queries ChromaDB collections based on thread's `categorySlugs`

### 1.3 Current Chat Flow

```
User sends message
       ↓
Get thread categories (thread_categories table)
       ↓
Query ChromaDB (category collections + global)
       ↓
Load GLOBAL system prompt (same for everyone)
       ↓
Generate response with context
       ↓
Return answer with sources
```

---

## 2. Proposed System: Subscription-Based Prompts

### 2.1 Core Concept

The AI assistant behavior adapts based on the thread's subscription context:

| Thread Categories | Prompt Type | Behavior |
|-------------------|-------------|----------|
| 0 (none) | Default | General knowledge assistant |
| 1 (single) | Category-Specific | Specialized expert for that domain |
| 2+ (multiple) | Multi-Category | Cross-domain synthesizer |

### 2.2 Proposed Chat Flow

```
User sends message
       ↓
Get thread categories
       ↓
┌─────────────────────────────────────┐
│      PROMPT RESOLUTION LOGIC        │
├─────────────────────────────────────┤
│ if (categories.length === 0)        │
│   → use DEFAULT prompt              │
│ else if (categories.length === 1)   │
│   → use CATEGORY-SPECIFIC prompt    │
│ else                                │
│   → use MULTI-CATEGORY prompt       │
└─────────────────────────────────────┘
       ↓
Query ChromaDB with resolved context
       ↓
Generate response with RESOLVED prompt
       ↓
Return answer with sources
```

---

## 3. Design Decisions Required

### 3.1 Function Calling Approach

**Decision Required: How should category-specific functions work?**

#### Option A: Tool Calling (OpenAI Function Calling)

```
System registers tools like:
- egov_maturity_assessment
- roadmap
- standards_review
- policy_review
- coach_assistant

AI decides when to invoke based on conversation context.
```

| Pros | Cons |
|------|------|
| Powerful and flexible | More complex to implement |
| AI autonomously decides when to use | Requires defining tool schemas |
| Can integrate with external systems | May need external service integration |
| Structured outputs guaranteed | Higher token usage |

#### Option B: Prompt-Based (Structured Instructions)

```
System prompt includes instructions like:
"When user asks about maturity assessment:
1. Ask clarifying questions about scope
2. Provide structured output in this format:
   - Current State: ...
   - Gap Analysis: ...
   - Recommendations: ..."
```

| Pros | Cons |
|------|------|
| Simpler to implement | Less structured outputs |
| Easier for superusers to customize | AI may not follow format consistently |
| No external dependencies | No integration with external systems |
| Lower complexity | Harder to enforce specific workflows |

#### Option C: Hybrid Approach (Recommended)

```
v1: Prompt-based (simple, fast to implement)
v2: Add tool calling for specific high-value functions
```

| Pros | Cons |
|------|------|
| Start simple, evolve as needed | Two-phase implementation |
| Validate approach before complexity | |
| Best of both worlds over time | |

---

### 3.2 Prompt Management Permissions

**Decision Required: Who can manage which prompts?**

#### Option A: Current Proposal (Recommended)

| Prompt Type | Admin | Superuser | User |
|-------------|-------|-----------|------|
| Default (no subscriptions) | Edit | View | - |
| Multi-Category | Edit | View | - |
| Category-Specific | Edit ALL | Edit ASSIGNED only | - |

#### Option B: Stricter Control with Approval

| Prompt Type | Admin | Superuser | User |
|-------------|-------|-----------|------|
| Default | Edit | - | - |
| Multi-Category | Edit | - | - |
| Category-Specific | Edit + Approve | Propose changes | - |

**Questions to resolve:**
1. Should superusers be able to directly edit category prompts, or propose changes for admin approval?
2. Should there be prompt versioning/history for audit?
3. Should there be a "preview" mode to test prompts before publishing?

---

### 3.3 UI/UX for Chat Interface

**Decision Required: How should the chat interface reflect subscription context?**

#### Current Branding Behavior (from UI_WIREFRAMES.md)

```
┌─────────────────────────────────────────────────────────────────┐
│  User with 1 subscription (e.g., "EA"):                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  EA Assistant                                              │  │
│  │  Ask questions about Enterprise Architecture               │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  User with 2+ subscriptions (e.g., "EA" and "DTA"):             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  GEA Global Assistant                                      │  │
│  │  Ask questions about GEA Global                            │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Admin/superuser with 0 subscriptions:                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Policy Bot                                                │  │
│  │  Ask questions about policy documents                      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

#### Branding Options

| Option | Description | Complexity |
|--------|-------------|------------|
| **A: Thread-Level** | Branding changes based on categories selected for thread | Medium |
| **B: Category Config** | Each category has custom name, description, icon | High |
| **C: Keep Current + Badge** | Current logic + "EA Mode" indicator badge | Low |

---

### 3.4 Fallback Behavior

**Decision Required: What happens when category-specific prompt is not configured?**

```
User selects "EA" category for thread
       ↓
System looks for EA-specific prompt
       ↓
         PROMPT NOT FOUND - What happens?
```

| Option | Description | Recommendation |
|--------|-------------|----------------|
| A | Fall back to DEFAULT prompt | Simple but loses context |
| B | Fall back to MULTI-CATEGORY prompt | Inconsistent |
| C | Use TEMPLATE with category context injection | **Recommended** |
| D | Block and notify admin | Too restrictive |

**Option C Detail:** Default prompt includes `{{CATEGORY_NAME}}` and `{{CATEGORY_DESCRIPTION}}` placeholders that get filled automatically.

---

### 3.5 Category-Specific Function Examples

**Decision Required: Define specific functions per category**

#### EA (Enterprise Architecture)

| Function | Description | Implementation |
|----------|-------------|----------------|
| `egov_maturity_assessment` | Assess e-government maturity | Structured Q&A + scoring |
| `roadmap` | Generate transformation roadmap | Phased output template |
| `standards_review` | Review against EA standards | Compliance checklist |

#### DTA (Digital Transformation Agency)

| Function | Description | Implementation |
|----------|-------------|----------------|
| `policy_review` | Analyze policy compliance | Gap analysis template |

#### Change Management

| Function | Description | Implementation |
|----------|-------------|----------------|
| `coach_assistant` | Provide change coaching | Coaching framework |

**Questions to resolve:**
1. Tool calls vs prompt-engineered structured outputs?
2. Should outputs be stored/tracked for reporting?
3. Should there be templates for each function output?

---

## 4. Database Schema Proposal

### 4.1 New Table: category_prompts

```sql
CREATE TABLE IF NOT EXISTS category_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER UNIQUE NOT NULL,
  system_prompt TEXT NOT NULL,
  tools_enabled TEXT,                 -- JSON: ["tool1", "tool2"]
  assistant_name TEXT,                -- Optional custom name
  assistant_description TEXT,         -- Optional custom description
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
```

### 4.2 Settings Updates

| Key | Description | Managed By |
|-----|-------------|------------|
| `system-prompt-default` | Prompt for no subscriptions | Admin |
| `system-prompt-multi` | Prompt for multiple subscriptions | Admin |

---

## 5. Implementation Phases

### Phase 1: Foundation (v1)
- [ ] Database schema for `category_prompts`
- [ ] Prompt resolver logic
- [ ] Settings for default + multi prompts
- [ ] Basic admin UI for all prompts
- [ ] Basic superuser UI for assigned category prompts
- [ ] Fallback to default when category prompt missing

### Phase 2: Enhanced (v2)
- [ ] Category-specific tool definitions (if Option A chosen)
- [ ] Tool toggle UI in prompt editor
- [ ] Prompt templates/presets
- [ ] Category-specific branding (name, description)

### Phase 3: Advanced (v3)
- [ ] Webhook-based external tool integrations
- [ ] Prompt versioning/history
- [ ] Approval workflow for superuser changes
- [ ] Analytics on prompt effectiveness

---

## 6. Open Questions Summary

| # | Question | Options | Decision |
|---|----------|---------|----------|
| 1 | Function calling approach | A: Tools, B: Prompts, C: Hybrid | TBD |
| 2 | Superuser edit permissions | Direct edit vs. Propose for approval | TBD |
| 3 | Chat UI branding | Thread-level, Category config, Badge | TBD |
| 4 | Fallback behavior | Default, Multi-cat, Template injection | TBD |
| 5 | Function output storage | Store for reporting vs. Ephemeral | TBD |
| 6 | Prompt preview/testing | Required for v1 vs. Later | TBD |

---

## 7. Example System Prompts

### 7.1 Default Prompt (No Subscriptions)

```markdown
# Government Policy & Strategy Assistant

You are a knowledgeable assistant helping users understand government
policies and documents. Use the provided context to answer questions
accurately.

## Guidelines
- Only use information from the provided context
- Cite sources when possible
- If information is not in context, say so clearly
- Maintain professional, neutral tone
```

### 7.2 Multi-Category Prompt

```markdown
# Cross-Domain Policy Assistant

You help users analyze information across multiple policy domains.

## Guidelines
- Clearly indicate which domain/category information comes from
- Highlight connections between domains
- If domains have conflicting guidance, present both perspectives
- Synthesize cross-cutting themes when relevant
```

### 7.3 Category-Specific Prompt (EA Example)

```markdown
# Enterprise Architecture Expert

You are a specialist in Enterprise Architecture, e-government frameworks,
and digital transformation standards.

## Your Capabilities
- Assess e-government maturity levels
- Create transformation roadmaps
- Review proposals against EA standards
- Explain EA frameworks and methodologies

## Response Style
- Use structured formats for assessments
- Reference specific standards when applicable
- Provide actionable recommendations

## When Asked About Maturity Assessment
Provide structured output:
1. Current State Analysis
2. Gap Identification
3. Maturity Score (1-5 scale)
4. Priority Recommendations
5. Suggested Next Steps
```

---

## 8. Next Steps

1. **Review this document** and make decisions on open questions
2. **Prioritize** which features are must-have for v1
3. **Finalize** database schema based on decisions
4. **Begin implementation** with Phase 1 foundation

---

*Document Version: 1.0*
*Created: 2025-12-05*
