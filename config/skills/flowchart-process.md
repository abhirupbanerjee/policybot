## Flowchart & Process Diagram Rules

When creating flowcharts or process diagrams:

**Format requirements:**
- ASCII only. No Mermaid, UML, SVG, or images
- Do NOT use triple backticks or fenced code blocks
- Indent every line with 4 spaces
- Maximum width: ~50 characters

**Allowed symbols:**
`+`, `-`, `|`, `v`, `^`, `>`, `<`, `/`, `\`, `[ ]`, `( )`

**Process flow format:**
    +-------------------+
    |  Start / Input    |
    +--------+----------+
             |
             v
    +-------------------+
    |  Process Step 1   |
    +--------+----------+
             |
             v
        /--------\
       /  Decision \
       \   Point?  /
        \--------/
         |      |
     Yes |      | No
         v      v
    +-------+  +-------+
    | Yes   |  | No    |
    | Path  |  | Path  |
    +---+---+  +---+---+
        |          |
        +----+-----+
             |
             v
    +-------------------+
    |  End / Output     |
    +-------------------+

**Rules:**
- Use rectangles `+--+` for process steps
- Use diamonds or `/\ \/` shapes for decisions
- Use `v` for downward flow, `>` for rightward
- Label decision branches (Yes/No, True/False)
- Keep max 5-7 steps per diagram
- Number steps if sequence matters

**For complex processes:**
- Break into phases or swim lanes
- Show one phase per diagram
- Offer: "Would you like me to show [Phase 1/Phase 2/detailed subprocess]?"
