# SOE Assessment Task Planner Documentation

This folder contains everything needed to set up the SOE (State-Owned Enterprise) assessment capability in Policy Bot.

## Contents

| File | Purpose | Where to Use |
|------|---------|--------------|
| [SOE_Assessment_Framework.md](./SOE_Assessment_Framework.md) | Knowledge base document | Upload as text document to SOE category |
| [SOE_Skill_Prompt.md](./SOE_Skill_Prompt.md) | Skill configuration and prompt | Create as category-triggered skill |
| [SOE_Templates.md](./SOE_Templates.md) | Task planner templates | Create in Admin > Tools > Task Planner |

## Setup Order

### Step 1: Upload Knowledge Base Document

1. Go to **Admin > Documents**
2. Click **Upload Text Content**
3. Copy the entire content of `SOE_Assessment_Framework.md`
4. Set title: "SOE Assessment Framework"
5. Assign to **SOE** category
6. Click Upload

This document will be indexed and retrieved via RAG when users ask about SOE assessment methodology.

### Step 2: Create the Skill

1. Go to **Admin > Skills**
2. Click **Create Skill**
3. Configure:
   - **Name**: SOE Assessment Guide
   - **Trigger Type**: Category
   - **Categories**: Select "SOE"
   - **Active**: Yes
4. Copy the prompt content from `SOE_Skill_Prompt.md` (everything after "## Skill Prompt Content")
5. Click Save

The skill will inject these instructions whenever a user is in the SOE category context.

### Step 3: Create Task Planner Templates

1. Go to **Admin > Tools**
2. Find **Task Planner** and click to expand
3. Select **SOE** category from the dropdown
4. Create three templates using the specifications in `SOE_Templates.md`:
   - `soe_identify` - 8 tasks
   - `soe_assess_single` - 18 tasks
   - `soe_report` - 10 tasks

See `SOE_Templates.md` for detailed task descriptions and JSON references.

## How It Works

```
User Message: "Assess SOEs in Trinidad"
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 1. RAG retrieves SOE Assessment Framework document            │
│    - Provides methodology, scoring criteria, definitions      │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 2. SOE Assessment Guide skill is injected                     │
│    - Tells LLM about available templates                      │
│    - Provides workflow instructions                           │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 3. LLM calls task_planner tool                                │
│    - template: "soe_identify"                                 │
│    - template_variables: {"country": "Trinidad"}              │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 4. Task planner creates plan from template                    │
│    - Replaces {country} with "Trinidad"                       │
│    - Creates 8 tasks in database                              │
│    - Returns plan to LLM                                      │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 5. LLM executes tasks sequentially                            │
│    - Searches knowledge base                                  │
│    - Performs web searches                                    │
│    - Updates task status as it progresses                     │
│    - Presents findings to user                                │
└───────────────────────────────────────────────────────────────┘
```

## Testing

After setup, test with these queries:

1. **Simple question** (should NOT use task planner):
   ```
   What is WASA's debt level?
   ```

2. **Country assessment** (should use `soe_identify` template):
   ```
   Assess all SOEs in Trinidad
   ```

3. **Single SOE assessment** (should use `soe_assess_single` template):
   ```
   Evaluate WASA using the 6-dimension framework
   ```

4. **Consolidated report** (should use `soe_report` template):
   ```
   Create a consolidated SOE report for Jamaica
   ```

## Customization

### Adding More Templates

You can create additional templates for specific use cases:

- `soe_quick_scan` - Abbreviated assessment with fewer tasks
- `soe_governance_deep_dive` - Focused governance analysis
- `soe_financial_audit` - Detailed financial review

### Modifying Scoring Criteria

Edit the `SOE_Assessment_Framework.md` document and re-upload to change:
- Dimension scoring thresholds
- Red flag definitions
- Policy pathway criteria

### Regional Variations

Create country-specific templates with pre-filled data sources:
- `soe_identify_caribbean` - Caribbean-specific sources
- `soe_identify_pacific` - Pacific island sources

## Troubleshooting

### LLM doesn't use templates

**Cause**: Skill not properly configured or not linked to category

**Fix**:
1. Verify skill is Active
2. Verify skill is linked to SOE category
3. Check that user's thread is in SOE category context

### Template not found error

**Cause**: Template key mismatch or wrong category

**Fix**:
1. Verify template key exactly matches (e.g., `soe_identify`)
2. Verify template is in the correct category
3. Verify template is marked as Active

### Placeholders not replaced

**Cause**: Placeholder name mismatch

**Fix**:
1. Ensure placeholder in template matches exactly (case-sensitive)
2. Ensure LLM passes `template_variables` with correct keys
