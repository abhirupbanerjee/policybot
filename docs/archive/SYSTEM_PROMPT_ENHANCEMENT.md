# System Prompt Enhancement - Tool Documentation

**Date:** December 3, 2025
**Status:** ✅ Complete

---

## Summary

Enhanced the system prompt to include comprehensive documentation about:
1. **How knowledge base search works** (vector search, semantic similarity)
2. **Available tools** (web_search) and when to use them
3. **Context format** that the LLM receives
4. **No results handling** strategy

This makes the LLM more aware of its capabilities and better at choosing the right approach for each query.

---

## What Was Added

### 1. Knowledge Base Search Documentation

```markdown
## Knowledge Base Search
When a user asks a question:
1. The system automatically searches the organizational knowledge base (vector database)
2. Relevant document chunks are retrieved based on semantic similarity
3. These chunks are provided to you as "Organizational Knowledge Base" context
4. Each chunk includes source information: [Source: Document Name, Page X]
5. You MUST answer using ONLY this provided context - never use external knowledge
```

**Why This Matters:**
- LLM understands it's working with RAG (Retrieval Augmented Generation)
- LLM knows chunks are automatically retrieved (not manually provided)
- LLM understands the [Source: ...] format for proper citation
- LLM knows to ONLY use provided context (no hallucination from training data)

### 2. Available Tools Documentation

```markdown
## Available Tools
You have access to the following tools:

**web_search**: Search the web for current information when:
- The knowledge base doesn't contain the answer
- User asks about recent events, current data, or real-time information
- User explicitly requests web search
- The query is clearly outside organizational documents scope

**When to use web_search:**
- "What's the current weather?" → Use web_search ✅
- "What are the latest news about AI?" → Use web_search ✅
- "What's our leave policy?" → Use knowledge base context ❌

**Important**: Always prioritize knowledge base content. Only use web_search when knowledge base is insufficient.
```

**Why This Matters:**
- LLM knows it has web_search capability
- LLM understands WHEN to use web_search (clear decision criteria)
- LLM prioritizes knowledge base over web search
- LLM has concrete examples to guide decisions

### 3. No Results Handling Strategy

```markdown
## When Knowledge Base Has No Results
If you receive: "No relevant documents found in the knowledge base." as context:
1. Acknowledge that organizational documents don't contain this information
2. Consider if web_search is appropriate for the query
3. If not appropriate for web search, clearly state the limitation
4. Suggest alternative actions (contact specific department, check other resources)
```

**Why This Matters:**
- LLM knows what to do when RAG returns nothing
- LLM provides helpful guidance instead of generic "I don't know"
- LLM considers web_search as fallback option
- LLM suggests actionable next steps for user

---

## Impact on LLM Behavior

### Before Enhancement:
```
User: "What is DTA?"
[Knowledge base returns relevant chunks]
Bot: [Provides answer based on chunks]
```

**Problem:** LLM didn't understand WHY it was getting these chunks or where they came from.

### After Enhancement:
```
User: "What is DTA?"
[Knowledge base returns relevant chunks]
Bot: [Now UNDERSTANDS this is from vector search]
     [KNOWS to cite using [Source: ...] format]
     [AWARE it should only use this context]
     [Provides better-structured answer with proper citations]
```

### Before Enhancement (No Results):
```
User: "What's the weather?"
[Knowledge base returns: "No relevant documents found"]
Bot: "I don't have information about that."
```

**Problem:** LLM didn't know about web_search tool or when to use it.

### After Enhancement (No Results):
```
User: "What's the weather?"
[Knowledge base returns: "No relevant documents found"]
Bot: [RECOGNIZES this is outside organizational knowledge]
     [CONSIDERS web_search tool]
     [USES web_search to get current weather]
     "The current weather is [from web search]..."
```

---

## Specific Improvements

### 1. Better Tool Usage
**Before:** LLM might not use web_search even when appropriate
**After:** LLM understands when web_search is needed vs. when to rely on knowledge base

### 2. Better Citations
**Before:** LLM might cite vaguely or incorrectly
**After:** LLM understands the exact [Source: ...] format provided in chunks

### 3. Better Error Handling
**Before:** Generic "I don't know" responses
**After:** Structured responses with suggestions for next steps

### 4. Better Decision Making
**Before:** Might mix training data knowledge with provided context
**After:** Explicitly told to use ONLY provided context, never external knowledge

---

## Technical Details

### Location
[src/lib/storage.ts:124-179](../src/lib/storage.ts#L124-L179)

### Size Impact
- **Previous prompt**: ~100 tokens
- **New prompt**: ~1,440 tokens
- **Increase**: ~1,340 tokens
- **Cost**: ~$0.0014 per request (GPT-5-mini)
- **Worth it?** Absolutely - better tool usage and accuracy

### Lines Added
- **HOW YOU WORK section**: 56 lines (124-179)
- **Knowledge Base Search**: 18 lines
- **Available Tools**: 23 lines
- **No Results Handling**: 15 lines

---

## Testing

### Test 1: Knowledge Base Query
```
Query: "What is the leave policy?"
Expected: Uses knowledge base context, cites properly
Result: ✅ Works as expected
```

### Test 2: Web Search Query
```
Query: "What's the current weather?"
Expected: Recognizes knowledge base won't have this, uses web_search
Result: ✅ Uses web_search tool appropriately
```

### Test 3: No Results Query (Internal)
```
Query: "What is our quantum computing strategy?"
Expected: Acknowledges knowledge base limitation, suggests next steps
Result: ✅ Provides structured "not found" response
```

### Test 4: No Results Query (External)
```
Query: "What are the latest AI trends?"
Expected: Uses web_search for current information
Result: ✅ Uses web_search appropriately
```

---

## Benefits

### For Users:
1. **Better tool usage** - Right tool for the right query
2. **Clearer citations** - Proper source attribution
3. **Helpful fallbacks** - Actionable suggestions when info not found
4. **More accurate** - Less confusion about what the bot knows

### For Developers:
1. **Transparent behavior** - LLM's decision-making is clearer
2. **Better debugging** - Can trace why LLM chose certain approach
3. **Maintainable** - Easy to update tool documentation as tools are added
4. **Extensible** - Template for adding more tools in future

### For System:
1. **Reduced hallucination** - Explicit "use ONLY provided context" instruction
2. **Better tool utilization** - Tools are actually used when appropriate
3. **Consistent behavior** - Clear rules for LLM to follow
4. **Quality assurance** - LLM self-aware of its information sources

---

## Future Enhancements

### When More Tools Added:
The "Available Tools" section can be extended:

```markdown
## Available Tools

**web_search**: [existing documentation]

**calculator**: Perform mathematical calculations when:
- User asks for numerical computations
- Complex math beyond simple arithmetic
- Example: "What's 15% of 1,234,567?"

**image_search**: Find relevant images when:
- User asks for visual information
- Documents reference diagrams not in text
- Example: "Show me the network architecture diagram"
```

### Enhanced Context Awareness:
Could add information about:
- User-uploaded documents vs. global knowledge base
- Document types and categories
- Metadata filtering capabilities

---

## Related Changes

This enhancement builds on:
- [PHASE1_IMPLEMENTATION_SUMMARY.md](./PHASE1_IMPLEMENTATION_SUMMARY.md) - Removed "policy" hardcoding
- [FORMATTING_IMPROVEMENTS.md](./FORMATTING_IMPROVEMENTS.md) - Enhanced formatting rules

Together, these changes create a comprehensive system prompt that:
1. ✅ Handles all document types (Phase 1)
2. ✅ Produces readable, well-formatted output (Formatting)
3. ✅ Understands its tools and capabilities (This enhancement)

---

## Deployment

### No Additional Steps Required
This enhancement is part of the system prompt update. If you've already deployed the formatting improvements, this is included.

### Verification
```bash
npx tsx test-formatting.js
```

Should show:
```
📊 Prompt Statistics:
  • Total Length: 5,756 characters
  • Lines: 163
```

---

## Conclusion

✅ **System prompt now includes comprehensive tool and capability documentation**

The LLM is now "self-aware" of:
- How it receives information (RAG search)
- What tools it has access to (web_search)
- When to use each capability (clear decision criteria)
- How to handle edge cases (no results, limitations)

This makes the bot more intelligent, accurate, and helpful.

---

**Updated By:** Claude Code
**Testing Status:** ✅ Verified
**Production Ready:** ✅ Yes
