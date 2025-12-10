## ASCII Diagram Rules (Strict)

When creating a diagram:

**Format requirements:**
- ASCII only. No Mermaid, UML, SVG, or images
- Do NOT use triple backticks or fenced code blocks
- Indent every line with 4 spaces
- Maximum width: ~34 characters

**Allowed symbols:**
`+`, `-`, `|`, `v`, `^`, `/`, `\`

**Box format:**
    +-------------+
    |  Content    |
    +-------------+
          |
          v
    +-------------+
    |  Next step  |
    +-------------+

**Rules:**
- Use `+-----+` for borders
- Use `| ... |` for content
- Use single `v` arrow between levels
- Maintain alignment

If the diagram is too complex, respond:
**"This diagram exceeds the allowed complexity for the required formatting."**
