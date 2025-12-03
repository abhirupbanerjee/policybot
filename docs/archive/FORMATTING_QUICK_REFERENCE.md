# Formatting Quick Reference

**Quick guide to the new bot response formatting**

---

## ✅ What Changed

The bot now follows strict formatting rules to make responses more readable.

---

## 📋 Standard Response Format

Every response follows this template:

```markdown
## Context
[1-2 sentence summary]

## Key Findings
• **Label**: Brief explanation `[Citation]`

## Detailed Analysis

✅ **Aligned Areas**
Finding with evidence `[Doc, Page X]`

⚠️ **Partial Matches**
Finding with evidence `[Doc, Page X]`

❌ **Gaps**
Finding with evidence `[Doc, Page X]`

## Recommendations
1. **Action**: Explanation

## Sources Referenced
• `[Document Name, Page X]`
```

---

## 🎨 Visual Indicators

| Symbol | Meaning | When Used |
|--------|---------|-----------|
| ✅ | Alignment, confirmation | Something matches or is correct |
| ⚠️ | Partial, concern | Something needs attention |
| ❌ | Gap, missing | Something is missing or wrong |
| 🔍 | Review needed | Needs investigation |
| 📋 | Reference | Document evidence |

---

## 📝 Key Rules

### Headers
- **ALL** major sections use `##`
- Sub-sections use `###`
- Blank line AFTER every header

### Paragraphs
- Maximum **3 lines** per paragraph
- Blank line BETWEEN paragraphs

### Citations
- ALWAYS in `` `code blocks` ``
- Format: `` `[Document Name, Page X]` ``
- Placed IMMEDIATELY after claim

### Lists
- Bullets: `•` for unordered items
- Numbers: `1., 2., 3.` for sequential steps

---

## ✅ Good Example

```markdown
## Context
You asked about the leave policy for annual leave.

## Key Findings

• **Annual Leave Entitlement**: Staff receive 20 days per year
  `[HR Policy Manual, Page 15]`

• **Carry Over**: Maximum 5 days can be carried to next year
  `[HR Policy Manual, Page 16]`

## Recommendations

1. **Review Balance**: Check your current leave balance in the portal
2. **Plan Ahead**: Submit requests at least 2 weeks in advance

## Sources Referenced
• `[HR Policy Manual, Page 15-16]`
```

---

## ❌ Bad Example (Old Format)

```markdown
Staff are entitled to annual leave as per the HR policy which states
that all full-time employees receive 20 days of leave per year and
part-time staff receive pro-rated amounts. This is outlined in the
HR Policy Manual on page 15. Additionally, there are rules about
carrying over leave from one year to the next which allow up to 5 days
maximum carryover as stated on page 16 of the same manual. You should
check your balance in the portal and plan ahead by submitting requests
at least 2 weeks in advance.
```

**Problems:**
- No headers or structure
- Dense 7-line paragraph
- Citations not in code blocks
- No visual indicators
- Hard to scan

---

## 🚀 Quick Verification

When you receive a bot response, check:

- [ ] Has `##` section headers?
- [ ] Has blank lines between sections?
- [ ] Citations in `` `code blocks` ``?
- [ ] Paragraphs ≤ 3 lines?
- [ ] Visual indicators (✅⚠️❌) present?

If YES to all → **Good formatting!** ✅

---

## 🔧 Troubleshooting

### "Response still looks dense"
→ Check paragraph length (should be ≤ 3 lines)
→ Check blank lines between sections

### "Can't find citations"
→ Look for text in `` `code blocks` ``
→ Should be at end of claims

### "Hard to scan"
→ Check for `##` headers
→ Check for visual indicators (✅⚠️❌)

---

## 📞 Report Issues

If responses don't follow this formatting:
1. Take a screenshot
2. Note the specific query
3. Report to admin

---

**Last Updated:** December 3, 2025
**Applies To:** All bot responses (policy-bot v1.1+)
