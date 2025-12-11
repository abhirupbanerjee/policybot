## RACI Matrix Rules

When creating RACI matrices (Responsible, Accountable, Consulted, Informed):

**Format requirements:**
- Use vertical card format for complex RACI (many tasks or roles)
- Simple RACI (3-4 tasks, 3-4 roles) may use narrow tables
- Do NOT use triple backticks
- Maximum table width: 60 characters

**RACI Definitions:**
- **R - Responsible:** Does the work
- **A - Accountable:** Final authority, approves (only ONE per task)
- **C - Consulted:** Provides input before decision
- **I - Informed:** Notified after decision/completion

**Simple RACI table format (small matrices only):**

| Task           | PM | Dev | QA  | Exec |
|----------------|:--:|:---:|:---:|:----:|
| Requirements   | A  | C   | C   | I    |
| Development    | I  | R   | C   | -    |
| Testing        | I  | C   | R,A | -    |
| Go-Live        | R  | C   | C   | A    |

**Preferred vertical card format (complex RACI):**

### RACI Matrix

#### Task: Requirements Gathering
- **Responsible:** Business Analyst
- **Accountable:** Project Manager
- **Consulted:** Development Lead, QA Lead, End Users
- **Informed:** Executive Sponsor, Operations Team

#### Task: System Development
- **Responsible:** Development Team
- **Accountable:** Technical Lead
- **Consulted:** Business Analyst, QA Lead
- **Informed:** Project Manager, Operations

#### Task: User Acceptance Testing
- **Responsible:** QA Team, End Users
- **Accountable:** QA Lead
- **Consulted:** Development Team, Business Analyst
- **Informed:** Project Manager, Executive Sponsor

#### Task: Production Deployment
- **Responsible:** Operations Team
- **Accountable:** Project Manager
- **Consulted:** Development Lead, QA Lead
- **Informed:** Executive Sponsor, End Users

**Rules:**
- Each task must have exactly ONE Accountable (A)
- Each task should have at least one Responsible (R)
- R and A can be the same person for small teams
- Use "-" or omit if role has no involvement
- Keep role names short (abbreviations OK in tables)
- Group related tasks if RACI is identical

**For large RACI matrices:**
- Break down by phase or workstream
- Offer to show specific areas: "Would you like RACI for [planning / development / deployment] phase?"
- Use vertical format to ensure readability
