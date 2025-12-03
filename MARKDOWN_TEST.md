# Markdown Styling Test

This document tests all the enhanced markdown features implemented in the Policy Bot.

## Headings Test

### H3 Heading
#### H4 Heading
##### H5 Heading
###### H6 Heading

## Text Formatting

This is regular text with **bold text**, *italic text*, and `inline code`.

Here's a paragraph with a very long URL to test word breaking: https://example.com/very/long/path/to/some/resource/that/might/break/the/layout/if/not/handled/properly

## Lists

### Unordered List
- First item
- Second item
- Third item with `inline code`
  - Nested item 1
  - Nested item 2

### Ordered List
1. First step
2. Second step
3. Third step
   1. Nested step a
   2. Nested step b

## Blockquotes

> This is a blockquote with italic text styling and a blue left border.
> It should have a subtle background color.
>
> Multiple paragraphs are supported.

## Code Blocks

Here's a JavaScript code block:

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
  return true;
}

const message = greet("World");
```

Here's a Python code block:

```python
def calculate_sum(a, b):
    """Calculate the sum of two numbers."""
    return a + b

result = calculate_sum(10, 20)
print(f"Result: {result}")
```

## Tables

| Feature | Status | Priority |
|---------|--------|----------|
| Tables | ✅ Complete | High |
| Blockquotes | ✅ Complete | Medium |
| Code Blocks | ✅ Complete | High |
| Links | ✅ Complete | Medium |
| Lists | ✅ Complete | Low |

### Complex Table with Alignment

| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Item 1 | $100 | 10% |
| Item 2 | $200 | 20% |
| Item 3 | $300 | 30% |

## Links

- Internal link: [Home](/)
- External link: [Google](https://google.com) (should show external icon)
- Another external link: [GitHub](https://github.com)
- Anchor link: [Back to top](#markdown-styling-test)

## Horizontal Rule

---

## Mixed Content

Here's a complex example with multiple elements:

### Step 1: Install Dependencies

Run the following command:

```bash
npm install react-markdown remark-gfm
```

### Step 2: Configuration

> **Note:** Make sure to configure your `tailwind.config.ts` file properly.

Add the following to your config:

```typescript
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
}
```

### Step 3: Summary

| Task | Description | Status |
|------|-------------|--------|
| Install | Install required packages | ✅ Done |
| Configure | Update config files | ✅ Done |
| Test | Run tests | 🔄 In Progress |

---

**End of Test Document**
