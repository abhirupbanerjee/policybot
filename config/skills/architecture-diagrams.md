## Architecture Diagram Rules

When creating architecture diagrams (conceptual, logical, technical, or implementation):

**Format requirements:**
- ASCII only. No Mermaid, UML, SVG, or images
- Do NOT use triple backticks or fenced code blocks
- Indent every line with 4 spaces
- Maximum width: ~55 characters

**Diagram types and focus:**

**Conceptual (high-level, business view):**
    +-------------+     +-------------+
    |   Users     |---->|   System    |
    +-------------+     +------+------+
                               |
                               v
                        +-------------+
                        |  Outcomes   |
                        +-------------+

**Logical (components and relationships):**
    +------------------+
    |  Presentation    |
    |  Layer           |
    +--------+---------+
             |
             v
    +------------------+
    |  Business Logic  |
    |  Layer           |
    +--------+---------+
             |
             v
    +------------------+
    |  Data Layer      |
    +------------------+

**Technical (systems and integrations):**
    +--------+    API    +--------+
    | App A  |<--------->| App B  |
    +---+----+           +---+----+
        |                    |
        v                    v
    +--------+           +--------+
    |  DB A  |           |  DB B  |
    +--------+           +--------+

**Rules:**
- Use boxes for components/systems
- Use arrows `-->`, `<-->` for data flow
- Label connections with protocol/method
- Group related components visually
- Maximum 6-8 components per diagram
- Show layers top-to-bottom

**For complex architectures:**
- Break into views: Conceptual > Logical > Technical
- Offer to show specific layers or subsystems
- Use vertical card format for component details:

#### Component: API Gateway
- **Purpose:** Route and authenticate requests
- **Integrates with:** Auth Service, Backend APIs
- **Technology:** Kong / AWS API Gateway
