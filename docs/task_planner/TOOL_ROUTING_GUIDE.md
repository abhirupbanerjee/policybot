# Tool Routing - Feature Guide

## What is Tool Routing?

Tool Routing allows administrators to configure keyword and regex patterns that **force specific tools to be called** when user messages match those patterns. Instead of relying on the LLM to decide which tool to use, routing rules ensure deterministic, predictable tool invocation.

### Why Use Tool Routing?

Without routing rules, the LLM may:
- Write prose about creating a chart instead of actually calling the chart tool
- Ask for confirmation before generating visualizations
- Describe assessment steps instead of using the Task Planner
- Explain how to search instead of performing the search

Tool routing solves this by setting the `tool_choice` parameter in the OpenAI API, forcing the LLM to call specific tools.

---

## Accessing Tool Routing

1. Log in as an **Admin**
2. Navigate to **Admin Dashboard**
3. Click the **Tools** tab
4. Select the **Tool Routing** sub-tab

![Tool Routing Tab Location](../../screenshots/tool-routing-tab.png)

---

## The Edit Routing Rule Modal

When you click **Add Rule** or edit an existing rule, the modal appears with the following fields:

### Tool Name (Required)

```
Field: Tool Name *
Example: chart_gen
```

The internal name of the tool to invoke when patterns match. This must exactly match the tool name defined in `tools.ts`.

**Common tool names:**
| Tool Name | Description |
|-----------|-------------|
| `chart_gen` | Chart/graph generation |
| `task_planner` | Multi-step task execution |
| `doc_gen` | PDF/Word document generation |
| `web_search` | Web search via Tavily |
| `youtube_search` | YouTube video search |
| `rag_query` | Document retrieval |

**Tip:** Check the Tools Management sub-tab to see all available tool names.

---

### Rule Name (Required)

```
Field: Rule Name *
Example: Chart Visualization Keywords
```

A descriptive, human-readable name for this routing rule. Used for identification in the rules list and test results.

**Best Practices:**
- Use descriptive names: "Chart Visualization Keywords" not "Rule 1"
- Include the tool name for clarity
- Indicate whether it's keyword or regex based

---

### Rule Type (Required)

```
Field: Rule Type *
Options: Keyword (word boundary matching) | Regex (regular expression)
```

#### Keyword Type
- **Case-insensitive** word boundary matching
- Matches whole words only
- Special regex characters are automatically escaped

**Examples:**
| Pattern | Matches | Does NOT Match |
|---------|---------|----------------|
| `chart` | "create a chart", "CHART please" | "charting", "barchart" |
| `bar chart` | "show me a bar chart" | "barchart", "bar charts" |
| `c++` | "learn c++ today" | "c++" embedded in other text |

#### Regex Type
- Full JavaScript regex syntax
- Case-insensitive by default
- More powerful but requires regex knowledge

**Examples:**
| Pattern | Matches |
|---------|---------|
| `\bchart\w*\b` | "chart", "charts", "charting" |
| `^create.*chart` | "create a pie chart", "create chart" |
| `visuai[sz]e` | "visualize", "visualise" (UK/US spelling) |
| `\d+\s*percent` | "50 percent", "100percent" |

---

### Patterns (Required)

```
Field: Patterns * (one per line)
```

Enter one pattern per line. Empty lines and whitespace-only lines are ignored.

**For Keyword Rules:**
```
chart
graph
plot
visualize
visualization
bar chart
pie chart
line graph
create a chart
show me a chart
```

**For Regex Rules:**
```
\bchart\w*\b
\bvisuali[sz]e\b
^create.*graph
\b(bar|pie|line)\s+chart\b
```

**Tips:**
- Start with common, specific patterns
- Add variations as you discover them through testing
- For keywords, include multi-word phrases users commonly say
- For regex, test patterns at [regex101.com](https://regex101.com) (select JavaScript flavor)

---

### Force Mode (Required)

```
Field: Force Mode *
Options: Required | Preferred | Suggested
```

Controls how strongly the tool is forced when patterns match.

#### Required (Recommended for most cases)
```
OpenAI tool_choice: { type: 'function', function: { name: 'tool_name' } }
```
- **Forces this specific tool** to be called
- LLM has no choice - it MUST call this tool
- Best for: chart generation, document creation, task planning

#### Preferred
```
OpenAI tool_choice: 'required'
```
- **Forces the LLM to use some tool**, but it can choose which one
- Useful when you want to ensure a tool is used but allow flexibility
- Best for: general tool activation without specifying which

#### Suggested
```
OpenAI tool_choice: 'auto'
```
- **Hint only** - LLM still decides whether to use a tool
- Essentially a no-op, included for completeness
- Best for: soft suggestions, testing patterns before enforcing

**Decision Guide:**
| Scenario | Recommended Mode |
|----------|------------------|
| User says "chart" and you want chart_gen called | Required |
| User mentions data and you want some analysis tool | Preferred |
| Testing a new pattern before enforcing | Suggested |

---

### Priority

```
Field: Priority
Default: 100
Range: 1-1000
```

Determines the order in which rules are evaluated when multiple rules could match.

**How it works:**
- **Lower number = Higher priority** (evaluated first)
- Rules with priority 10 are checked before priority 100
- When multiple rules match, the highest priority (lowest number) wins

**Recommended Priority Ranges:**
| Priority | Use Case |
|----------|----------|
| 1-10 | Critical, highly specific rules |
| 11-50 | Important tool-specific rules |
| 51-100 | Default rules |
| 101-500 | Fallback/catch-all rules |

**Example:**
```
Rule A: "create a bar chart" → chart_gen (priority: 10)
Rule B: "chart" → chart_gen (priority: 50)
Rule C: "create" → task_planner (priority: 100)
```

When user says "create a bar chart":
- Rule A matches (priority 10) ✓ Winner
- Rule B matches (priority 50)
- Rule C matches (priority 100)

Result: chart_gen is forced (Rule A wins due to lowest priority number)

---

### Category Filter (Optional)

```
Field: Category Filter (optional)
Type: Multi-select dropdown
```

Limit this routing rule to specific categories. When empty, the rule applies globally to all categories.

**How to use:**
- Leave empty for global rules
- Select one or more categories to scope the rule
- Hold Ctrl/Cmd to select multiple categories

**Use Cases:**
| Scenario | Configuration |
|----------|---------------|
| "chart" should trigger chart_gen everywhere | No categories (global) |
| "assessment" should trigger task_planner only in HR | Select "HR" category |
| "SOE" should trigger task_planner in multiple depts | Select relevant categories |

**How Category Matching Works:**
1. User sends message in Category A context
2. System retrieves all active routing rules
3. Rules are filtered: include if `categoryIds` is null OR contains Category A
4. Filtered rules are evaluated for pattern matches

---

### Active Toggle

```
Field: Rule is active
Type: Checkbox (default: checked)
```

Enable or disable the rule without deleting it.

**Use Cases:**
- Temporarily disable a rule for testing
- Keep rule configuration for future use
- A/B testing different routing strategies

---

## Multi-Match Resolution

When a user message matches multiple routing rules, the system resolves which `tool_choice` to use:

```
Multiple Rules Matched
        │
        ▼
┌───────────────────┐
│ Sort by priority  │
│ (lower first)     │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Count 'required'  │
│ mode matches      │
└───────────────────┘
        │
        ├── 0 required ──────────────────┐
        │                                │
        ├── 1 required ───▶ Force that   │
        │                   specific tool│
        │                                │
        └── 2+ required ──▶ tool_choice  │
                           = 'required'  │
                           (LLM picks)   │
                                         │
        ┌────────────────────────────────┘
        │
        ▼
┌───────────────────┐
│ Check 'preferred' │
│ mode matches      │
└───────────────────┘
        │
        ├── Has preferred ──▶ tool_choice = 'required'
        │
        └── Only suggested ──▶ tool_choice = 'auto'
```

---

## Testing Routing Rules

Before deploying rules, always test them using the built-in Test Panel.

### How to Test

1. Click the **Test** button in the header
2. Enter a test message in the textarea
3. (Optional) Select categories to simulate context
4. Click **Run Test**
5. Review results

### Understanding Test Results

**Result: `function:chart_gen`**
- A single required rule matched
- The specific tool (chart_gen) will be forced

**Result: `required`**
- Multiple required rules matched different tools
- LLM must use one of the matched tools but can choose which

**Result: `auto`**
- No required/preferred rules matched
- LLM decides whether to use any tool

### Test Examples

| Test Message | Expected Match | If No Match |
|--------------|----------------|-------------|
| "create a pie chart of sales" | chart_gen | Add "pie chart" pattern |
| "initiate SOE assessment" | task_planner | Add "initiate" or "assessment" |
| "generate a PDF report" | doc_gen | Add "PDF report" pattern |
| "hello world" | (no match) | Expected - no routing |

---

## Default Rules

On first access to Tool Routing, these default rules are automatically created:

### Chart Generator (Priority: 10)
```
Tool: chart_gen
Type: keyword
Patterns:
  - chart
  - graph
  - plot
  - visualize
  - visualization
  - bar chart
  - pie chart
  - line graph
  - histogram
  - create a chart
  - show me a chart
  - generate a chart
  - draw a graph
```

### Task Planner (Priority: 10)
```
Tool: task_planner
Type: keyword
Patterns:
  - initiate
  - assessment
  - evaluate all
  - assess all
  - review all
  - step by step
  - create a plan
  - multi-step
  - assessment plan
  - task plan
  - structured workflow
```

### Document Generator (Priority: 20)
```
Tool: doc_gen
Type: keyword
Patterns:
  - generate report
  - create pdf
  - export to pdf
  - download as pdf
  - save as pdf
  - formal document
  - create document
  - word document
  - docx
```

### Web Search (Priority: 30, Force Mode: preferred)
```
Tool: web_search
Type: keyword
Patterns:
  - search the web
  - look up online
  - find online
  - latest news
  - current information
  - recent updates
  - search online
```

---

## Best Practices

### 1. Start Specific, Then Generalize
Begin with specific phrases users actually say, then add broader patterns if needed.

```
Good progression:
1. "create a bar chart" (specific)
2. "bar chart" (slightly broader)
3. "chart" (catch-all)
```

### 2. Use Keyword Type When Possible
Keywords are easier to understand and maintain than regex. Only use regex when you need:
- Partial word matching (`\bchart\w*`)
- Multiple spellings (`visuali[sz]e`)
- Complex patterns (`^create.*(?:chart|graph)`)

### 3. Test Before Saving
Always use the Test Panel to verify your patterns match expected messages and don't match unintended ones.

### 4. Set Appropriate Priorities
- More specific rules should have lower priority numbers
- This ensures specific phrases are matched before generic keywords

### 5. Use Categories for Domain-Specific Rules
If "assessment" should mean different things in different categories, create separate rules scoped to each category.

### 6. Monitor and Iterate
Check server logs (`toolsLogger`) to see routing decisions in production. Adjust patterns based on real user behavior.

### 7. Don't Over-Route
Not every message needs tool routing. Let the LLM handle general queries naturally. Only route when you need guaranteed tool invocation.

---

## Troubleshooting

### Rule Not Matching

1. **Check Active Status** - Is the rule enabled?
2. **Verify Pattern** - Use Test Panel to check if pattern matches
3. **Check Rule Type** - Keywords match whole words; regex matches substrings
4. **Check Categories** - Is the rule scoped to a category the user isn't in?
5. **Check Priority** - Is another rule matching first?

### Wrong Tool Being Called

1. **Check Multi-Match** - Multiple rules may be matching
2. **Review Priorities** - Lower number wins
3. **Test the Exact Message** - Copy user's exact input into Test Panel

### Regex Not Working

1. **Escape Backslashes** - Use `\\b` not `\b` in the UI (or single `\b` works too)
2. **Test at regex101.com** - Verify pattern with JavaScript flavor
3. **Check for Invalid Syntax** - Invalid regex will silently fail to match

---

## Quick Reference

### Force Mode Summary
| Mode | Effect | Use When |
|------|--------|----------|
| Required | Forces specific tool | You want exactly this tool called |
| Preferred | Forces some tool | You want any tool, LLM picks |
| Suggested | No force (hint) | Testing or soft suggestions |

### Priority Guide
| Priority | Meaning |
|----------|---------|
| 1-10 | Critical rules |
| 11-50 | Important rules |
| 51-100 | Standard rules |
| 100+ | Fallback rules |

### Rule Type Comparison
| Feature | Keyword | Regex |
|---------|---------|-------|
| Case Sensitive | No | No (flag set) |
| Word Boundary | Automatic | Manual (`\b`) |
| Partial Match | No | Yes |
| Special Chars | Auto-escaped | Must escape |
| Complexity | Simple | Advanced |

---

*Last Updated: December 2024*
