# SOE Task Planner Templates

Create these templates in Admin > Tools > Task Planner for the SOE category.

---

## Template 1: soe_identify

### Configuration

| Field | Value |
|-------|-------|
| **Key** | `soe_identify` |
| **Name** | `{country} SOE Identification` |
| **Description** | Identify and prioritize SOEs in a country for assessment |
| **Placeholders** | `country` |
| **Active** | Yes |

### Tasks

| ID | Description |
|----|-------------|
| 1 | Search knowledge base for existing SOE information on {country} |
| 2 | Web search for {country} official SOE list and registry |
| 3 | Web search for {country} SOE fiscal data: subsidies, transfers, losses (2020-2024) |
| 4 | Web search for {country} SOE audit reports and Auditor General findings |
| 5 | Compile comprehensive SOE list with fiscal impact data for each entity |
| 6 | Calculate fiscal exposure: subsidies + losses + guarantees for each SOE |
| 7 | Rank SOEs by fiscal impact and apply Pareto filter (top 20%) |
| 8 | Present priority SOE list with fiscal impact summary to user for confirmation |

---

## Template 2: soe_assess_single

### Configuration

| Field | Value |
|-------|-------|
| **Key** | `soe_assess_single` |
| **Name** | `{soe_name} Assessment` |
| **Description** | Comprehensive 6-dimension health assessment of a single SOE |
| **Placeholders** | `soe_name` |
| **Active** | Yes |

### Tasks

| ID | Description |
|----|-------------|
| 1 | Search knowledge base for existing information on {soe_name} |
| 2 | Web search for {soe_name} background: history, mandate, restructuring events |
| 3 | Gather Financial Health data: revenue, profit/loss, assets, liabilities, debt (3-5 years) |
| 4 | Gather Operational Efficiency data: headcount, output metrics, capacity utilization |
| 5 | Gather Governance data: board composition, audit opinions, compliance status |
| 6 | Gather Staffing data: employee count trends, labor costs, productivity metrics |
| 7 | Gather Strategic Alignment data: mandate documents, PSO agreements, policy alignment |
| 8 | Gather Risk Exposure data: government guarantees, pension status, FX exposure, inter-SOE links |
| 9 | Score Financial Health dimension (0-100) with justification |
| 10 | Score Operational Efficiency dimension (0-100) with justification |
| 11 | Score Governance Quality dimension (0-100) with justification |
| 12 | Score Staffing & Human Capital dimension (0-100) with justification |
| 13 | Score Strategic Alignment dimension (0-100) with justification |
| 14 | Score Risk Exposure dimension (0-100) with justification |
| 15 | Evaluate 7 red flags and document which are triggered |
| 16 | Calculate Health Index: dimension average minus red flag penalties |
| 17 | Determine policy pathway based on Health Index score |
| 18 | Generate {soe_name} assessment summary with scores, red flags, and recommendations |

---

## Template 3: soe_report

### Configuration

| Field | Value |
|-------|-------|
| **Key** | `soe_report` |
| **Name** | `{country} SOE Consolidated Report` |
| **Description** | Generate consolidated report after multiple SOE assessments are complete |
| **Placeholders** | `country` |
| **Active** | Yes |

### Tasks

| ID | Description |
|----|-------------|
| 1 | Compile all completed SOE assessments for {country} from this conversation |
| 2 | Create summary table: SOE name, Health Index, pathway recommendation |
| 3 | Rank SOEs by Health Index score (lowest to highest risk) |
| 4 | Analyze inter-SOE dependencies: shared services, cross-guarantees, supply chains |
| 5 | Assess systemic risk: what happens if worst-performing SOEs fail simultaneously |
| 6 | Group SOEs by recommended policy pathway (Maintain/Reform/Restructure/Divest) |
| 7 | Identify cross-cutting themes: common governance gaps, sector-wide issues |
| 8 | Calculate total fiscal exposure across assessed SOE portfolio |
| 9 | Generate executive summary with key findings and priority actions |
| 10 | Create consolidated {country} SOE Assessment Report |

---

## How to Create Templates in Admin UI

### Step-by-Step Instructions

1. **Navigate to Admin Dashboard**
   - Go to `/admin`
   - Click on "Tools" tab

2. **Access Task Planner Templates**
   - Find "Task Planner" in the tools list
   - Click on it to expand
   - Click "Manage Templates" or navigate to the templates section

3. **Select Category**
   - Choose "SOE" (or your SOE category name) from the dropdown

4. **Create Each Template**

   For each template above:

   a. Click "Add Template" or "+ New"

   b. Fill in the fields:
      - **Key**: Enter exactly as shown (e.g., `soe_identify`)
      - **Name**: Enter with placeholder (e.g., `{country} SOE Identification`)
      - **Description**: Copy from table above
      - **Placeholders**: Enter comma-separated (e.g., `country`)

   c. Add tasks:
      - Click "Add Task" for each task
      - Enter ID (sequential: 1, 2, 3...)
      - Enter Description (copy from tables above)
      - Include `{placeholder}` where shown

   d. Ensure "Active" is checked

   e. Click "Save Template"

5. **Verify Templates**
   - All three templates should appear in the list
   - Each should show the correct number of tasks
   - Status should show as "Active"

---

## Template JSON Reference

If you need to import templates programmatically or via API, here's the JSON structure:

### soe_identify

```json
{
  "key": "soe_identify",
  "name": "{country} SOE Identification",
  "description": "Identify and prioritize SOEs in a country for assessment",
  "active": true,
  "placeholders": ["country"],
  "tasks": [
    {"id": 1, "description": "Search knowledge base for existing SOE information on {country}"},
    {"id": 2, "description": "Web search for {country} official SOE list and registry"},
    {"id": 3, "description": "Web search for {country} SOE fiscal data: subsidies, transfers, losses (2020-2024)"},
    {"id": 4, "description": "Web search for {country} SOE audit reports and Auditor General findings"},
    {"id": 5, "description": "Compile comprehensive SOE list with fiscal impact data for each entity"},
    {"id": 6, "description": "Calculate fiscal exposure: subsidies + losses + guarantees for each SOE"},
    {"id": 7, "description": "Rank SOEs by fiscal impact and apply Pareto filter (top 20%)"},
    {"id": 8, "description": "Present priority SOE list with fiscal impact summary to user for confirmation"}
  ]
}
```

### soe_assess_single

```json
{
  "key": "soe_assess_single",
  "name": "{soe_name} Assessment",
  "description": "Comprehensive 6-dimension health assessment of a single SOE",
  "active": true,
  "placeholders": ["soe_name"],
  "tasks": [
    {"id": 1, "description": "Search knowledge base for existing information on {soe_name}"},
    {"id": 2, "description": "Web search for {soe_name} background: history, mandate, restructuring events"},
    {"id": 3, "description": "Gather Financial Health data: revenue, profit/loss, assets, liabilities, debt (3-5 years)"},
    {"id": 4, "description": "Gather Operational Efficiency data: headcount, output metrics, capacity utilization"},
    {"id": 5, "description": "Gather Governance data: board composition, audit opinions, compliance status"},
    {"id": 6, "description": "Gather Staffing data: employee count trends, labor costs, productivity metrics"},
    {"id": 7, "description": "Gather Strategic Alignment data: mandate documents, PSO agreements, policy alignment"},
    {"id": 8, "description": "Gather Risk Exposure data: government guarantees, pension status, FX exposure, inter-SOE links"},
    {"id": 9, "description": "Score Financial Health dimension (0-100) with justification"},
    {"id": 10, "description": "Score Operational Efficiency dimension (0-100) with justification"},
    {"id": 11, "description": "Score Governance Quality dimension (0-100) with justification"},
    {"id": 12, "description": "Score Staffing & Human Capital dimension (0-100) with justification"},
    {"id": 13, "description": "Score Strategic Alignment dimension (0-100) with justification"},
    {"id": 14, "description": "Score Risk Exposure dimension (0-100) with justification"},
    {"id": 15, "description": "Evaluate 7 red flags and document which are triggered"},
    {"id": 16, "description": "Calculate Health Index: dimension average minus red flag penalties"},
    {"id": 17, "description": "Determine policy pathway based on Health Index score"},
    {"id": 18, "description": "Generate {soe_name} assessment summary with scores, red flags, and recommendations"}
  ]
}
```

### soe_report

```json
{
  "key": "soe_report",
  "name": "{country} SOE Consolidated Report",
  "description": "Generate consolidated report after multiple SOE assessments are complete",
  "active": true,
  "placeholders": ["country"],
  "tasks": [
    {"id": 1, "description": "Compile all completed SOE assessments for {country} from this conversation"},
    {"id": 2, "description": "Create summary table: SOE name, Health Index, pathway recommendation"},
    {"id": 3, "description": "Rank SOEs by Health Index score (lowest to highest risk)"},
    {"id": 4, "description": "Analyze inter-SOE dependencies: shared services, cross-guarantees, supply chains"},
    {"id": 5, "description": "Assess systemic risk: what happens if worst-performing SOEs fail simultaneously"},
    {"id": 6, "description": "Group SOEs by recommended policy pathway (Maintain/Reform/Restructure/Divest)"},
    {"id": 7, "description": "Identify cross-cutting themes: common governance gaps, sector-wide issues"},
    {"id": 8, "description": "Calculate total fiscal exposure across assessed SOE portfolio"},
    {"id": 9, "description": "Generate executive summary with key findings and priority actions"},
    {"id": 10, "description": "Create consolidated {country} SOE Assessment Report"}
  ]
}
```

---

## API Creation Example

To create a template via API:

```bash
curl -X POST https://your-domain.com/api/admin/tools/task-planner/templates \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "categoryId": 5,
    "key": "soe_identify",
    "name": "{country} SOE Identification",
    "description": "Identify and prioritize SOEs in a country for assessment",
    "placeholders": ["country"],
    "tasks": [
      {"id": 1, "description": "Search knowledge base for existing SOE information on {country}"},
      {"id": 2, "description": "Web search for {country} official SOE list and registry"},
      ...
    ]
  }'
```

Replace `categoryId: 5` with your actual SOE category ID.
