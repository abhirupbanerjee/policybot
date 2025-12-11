## ASCII Diagram Rules (Strict)

When creating a **flowchart, hierarchy, or process diagram**:

**Format requirements:**
- ASCII only. No Mermaid, UML, SVG, or images
- Do NOT use triple backticks or fenced code blocks
- Indent every line with 4 spaces
- Maximum width: ~50 characters per diagram

**Allowed symbols:**
`+`, `-`, `|`, `v`, `^`, `/`, `\`

**Box format:**
    +-------------------+
    |  Content          |
    +-------------------+
          |
          v
    +-------------------+
    |  Next step        |
    +-------------------+

**Rules:**
- Use `+-----+` for borders
- Use `| ... |` for content
- Use single `v` arrow between levels
- Maintain alignment

**For TABULAR DATA (comparisons, feature matrices):**
- Do NOT use wide ASCII tables or Markdown tables
- Use vertical card format: feature as heading, categories as bullets
- Group by feature/capability, list user types underneath
- Maximum 3-4 items per comparison group

**If the diagram is too complex, respond:**
**"This diagram is complex. Would you like me to break it down by [user type / feature category / process stage]?"**
