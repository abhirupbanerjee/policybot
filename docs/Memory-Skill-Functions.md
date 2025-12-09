

## Three New Features Overview

### 1. **Memory** (Thread History/Context)
**What it is:** Persistent conversation context within a thread that maintains the last 5 messages, allowing follow-up questions.

**Practical Example:**
```
User: "What is our leave policy?"
Bot: [responds with leave policy details]
User: "What about section 3?"  ← Bot understands "section 3" refers to leave policy
```

**Current State:** Basic 5-message history per thread stored in SQLite. Your roadmap mentions extending to **user-category-wise persistent memory** and **thread summarization** for cost optimization.

---

### 2. **Skills** (Modular Prompts)
**What it is:** Splitting the monolithic ~1,800-token global system prompt into composable, context-aware modules that activate based on thread category or keywords.

**Practical Example:**
| Skill Type | Trigger | Purpose |
|------------|---------|---------|
| Core (~550 tokens) | Always active | Base assistant behavior |
| Formatting | Keywords like "table", "list" | Output structure rules |
| EA Expert | Thread subscribed to EA category | Enterprise Architecture guidance |
| Coach | "coaching" keyword | Change management framework |

**How it works:**
```
Thread has EA category → Core Skill + EA Skill combined into system prompt
```

---

### 3. **Functions** (Admin-Defined Custom Tools)
**What it is:** Admin creates custom functions via UI that generate OpenAI-compatible JSON tool schemas, enabling structured workflows the AI can invoke.

**Practical Example:**
| Function | Category | What it does |
|----------|----------|--------------|
| `egov_maturity_assessment` | EA | Structured Q&A → 1-5 maturity score |
| `roadmap` | EA | Generates phased transformation plan |
| `policy_review` | DTA | Gap analysis against standards |

**How it works:**
```
User: "Assess our digital maturity"
→ AI invokes egov_maturity_assessment function
→ Returns structured output: Current State, Gaps, Score, Recommendations
```

---

## Comparison Table

| Aspect | Memory | Skills | Functions |
|--------|--------|--------|-----------|
| **Purpose** | Retain conversation context | Customize AI personality/expertise | Enable structured workflows |
| **Scope** | Per-thread | Per-category or keyword | Per-category (admin-defined) |
| **User-facing?** | Invisible (automatic) | Invisible (prompt changes) | Visible (structured outputs) |
| **Configured by** | System (automatic) | Admin/Super User | Admin only |
| **Storage** | SQLite (messages table) | category_prompts table | Tool schemas (JSON) |
| **Implementation** | ✅ Exists (basic) | 🚧 Planned | 🚧 Planned |
| **Example** | "What about section 3?" works | EA thread gets EA expert prompt | Maturity assessment with scoring |

