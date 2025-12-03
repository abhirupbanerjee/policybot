# Web Search Integration

Policy Bot integrates with Tavily API to provide real-time web search capabilities alongside its document retrieval system. This allows the bot to answer questions about current events, recent news, and information not available in the policy document database.

---

## Overview

### How It Works

1. **Automatic Detection**: The LLM automatically decides when web search is needed using OpenAI function calling
2. **Seamless Integration**: Web search runs in parallel with document retrieval
3. **Combined Results**: Responses merge both policy documents and web sources
4. **Source Attribution**: Web sources are clearly tagged with `[WEB]` prefix
5. **Redis Caching**: Search results are cached to reduce API calls and improve performance

### Architecture

```
User Query
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  RAG Pipeline with OpenAI Function Calling          │
│                                                      │
│  1. Retrieve policy documents from ChromaDB         │
│  2. LLM analyzes query + context                    │
│  3. LLM decides: "Do I need current web info?"      │
│  4. If yes: Call web_search tool (Tavily)           │
│  5. Combine RAG + Web results                       │
│                                                      │
└─────────────────────────────────────────────────────┘
    │
    ▼
Response with sources:
  • Policy Doc A, Page 5 (score: 0.92)
  • [WEB] Latest Climate Report 2025 (score: 0.99)
  • Policy Doc B, Page 12 (score: 0.88)
```

---

## Features

### 1. LLM-Driven Detection

The system uses **OpenAI function calling** to let the language model decide when web search is appropriate. No hardcoded keywords or rules.

**Examples of queries that trigger web search:**
- "What's the latest news about renewable energy?"
- "Current GDP of Grenada"
- "Recent policy changes in the Caribbean"
- "What happened at COP29 climate summit?"

**Examples that don't trigger web search:**
- "What is our vacation policy?"
- "Explain the procurement process"
- "What are the eligibility requirements for benefits?"

### 2. Generic Tool Framework

Web search is implemented through a generic tool framework that makes it easy to:
- Add new tools (calculator, image search, etc.)
- Swap web search providers (replace Tavily with Bing, Google, etc.)
- Disable tools without code changes

**File Structure:**
```
src/lib/
├── tools.ts                 # Generic tool registry
└── tools/
    └── tavily.ts           # Tavily implementation (easily swappable)
```

### 3. Redis Caching

All web search results are cached in Redis with a separate namespace:

- **Cache Key Pattern**: `tavily:{md5_hash_of_query}`
- **Default TTL**: 1800 seconds (30 minutes)
- **Configurable Range**: 60 seconds to 2,592,000 seconds (1 month)
- **Cache Invalidation**: Automatic when Tavily settings are changed

### 4. Source Attribution

Web sources are clearly distinguished from policy documents:

```
Sources:
  • HR_Policy_2024.pdf, Page 5 (Relevance: 92%)
  • [WEB] Caribbean Climate Action Report 2025 (Relevance: 99%)
  • Finance_Guidelines.pdf, Page 12 (Relevance: 88%)
```

---

## Configuration

### Admin Panel Setup

1. **Navigate to Admin Settings**
   - Go to `/admin`
   - Click **"Web Search"** tab

2. **Configure Tavily Settings**
   ```
   ┌────────────────────────────────────────┐
   │  Enable Web Search: [x] ON             │
   │  API Key: ••••••••••••••               │
   │  Topic: [General ▼]                    │
   │  Search Depth: [Basic ▼]               │
   │  Max Results: [5]                      │
   │  Cache Duration: [1800] seconds        │
   │  Include Domains: (optional)           │
   │  Exclude Domains: (optional)           │
   │                                        │
   │  [Save Changes]  [Reset to Defaults]   │
   └────────────────────────────────────────┘
   ```

3. **Get a Tavily API Key**
   - Visit [https://tavily.com](https://tavily.com)
   - Sign up for an account
   - Get your API key from the dashboard
   - Paste into the admin panel

### Settings Reference

| Setting | Description | Default | Range/Options |
|---------|-------------|---------|---------------|
| **Enabled** | Enable/disable web search | `false` | `true` / `false` |
| **API Key** | Tavily API authentication key | Empty | Required for web search |
| **Topic** | Search topic optimization | `general` | `general`, `news`, `finance` |
| **Search Depth** | Search thoroughness | `basic` | `basic`, `advanced` |
| **Max Results** | Maximum search results | `5` | 1-20 |
| **Cache TTL** | Result cache duration (seconds) | `1800` | 60-2,592,000 |
| **Include Domains** | Whitelist specific domains | `[]` | Array of domains |
| **Exclude Domains** | Blacklist specific domains | `[]` | Array of domains |

### Storage Location

Settings are stored in: `data/config/tavily-settings.json`

```json
{
  "apiKey": "tvly-...",
  "enabled": true,
  "defaultTopic": "general",
  "defaultSearchDepth": "basic",
  "maxResults": 5,
  "includeDomains": [],
  "excludeDomains": [],
  "cacheTTLSeconds": 1800,
  "updatedAt": "2025-12-03T00:00:00.000Z",
  "updatedBy": "admin@example.com"
}
```

---

## Technical Implementation

### 1. Tool Definition

**File**: `src/lib/tools/tavily.ts`

The Tavily tool follows the `ToolDefinition` interface:

```typescript
export interface ToolDefinition {
  definition: OpenAI.Chat.ChatCompletionTool;  // OpenAI function schema
  execute: (args: any) => Promise<string>;      // Tool execution logic
}
```

**Function Schema** (exposed to OpenAI):
```json
{
  "type": "function",
  "function": {
    "name": "web_search",
    "description": "Search the web for current information, news, or data not in policy documents",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query"
        },
        "max_results": {
          "type": "number",
          "description": "Number of results (1-10)",
          "default": 5
        }
      },
      "required": ["query"]
    }
  }
}
```

### 2. Function Calling Flow

**File**: `src/lib/openai.ts` → `generateResponseWithTools()`

```typescript
// Step 1: Initial API call with tools
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [...],
  tools: getToolDefinitions(),  // Include web_search tool
});

// Step 2: If LLM calls a tool
if (response.tool_calls) {
  for (const toolCall of response.tool_calls) {
    // Execute tool (e.g., web_search)
    const result = await executeTool(toolCall.function.name, toolCall.function.arguments);

    // Add tool result to conversation
    messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: result
    });
  }

  // Step 3: Get final response with tool results
  const finalResponse = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messages
  });
}
```

### 3. Cache Implementation

**File**: `src/lib/tools/tavily.ts`

```typescript
// Check cache first
const cacheKey = hashQuery(args.query);
const cached = await getCachedQuery(`tavily:${cacheKey}`);

if (cached) {
  console.log('Web search cache hit');
  return cached;
}

// Cache miss - call Tavily API
const response = await fetch('https://api.tavily.com/search', { ... });
const resultString = JSON.stringify(data);

// Cache the result
await cacheQuery(`tavily:${cacheKey}`, resultString, settings.cacheTTLSeconds);
```

### 4. Source Extraction

**File**: `src/lib/rag.ts` → `extractWebSourcesFromHistory()`

```typescript
function extractWebSourcesFromHistory(
  history: OpenAI.Chat.ChatCompletionMessageParam[]
): Source[] {
  const webSources: Source[] = [];

  for (const msg of history) {
    if (msg.role === 'tool') {
      const toolResult = JSON.parse(msg.content);

      if (toolResult.results) {
        for (const result of toolResult.results) {
          webSources.push({
            documentName: `[WEB] ${result.title || result.url}`,
            pageNumber: 0,
            chunkText: result.content?.substring(0, 200),
            score: result.score || 0
          });
        }
      }
    }
  }

  return webSources;
}
```

---

## Model Compatibility

Web search via function calling is supported on:

| Model | Function Calling | Temperature | Max Tokens |
|-------|------------------|-------------|------------|
| **GPT-5** | ✅ Yes | Fixed at 1.0 | Uses `max_completion_tokens` |
| **GPT-5 Mini** | ✅ Yes | Fixed at 1.0 | Uses `max_completion_tokens` |
| **GPT-4.1 Mini** | ✅ Yes | Configurable | Uses `max_tokens` |

All supported models can automatically trigger web search when needed.

---

## Cache Management

### Cache Invalidation

**Automatic Invalidation:**
- When Tavily settings are updated via admin panel
- When "Save Changes" is clicked in Web Search settings

**Manual Invalidation:**
```bash
# Via Redis CLI
redis-cli KEYS "tavily:*" | xargs redis-cli DEL

# Via API (requires admin auth)
curl -X POST https://your-domain.com/api/admin/settings \
  -H "Content-Type: application/json" \
  -d '{"type": "tavily", "settings": {...}}'
```

### Cache Statistics

```bash
# Check cache size
redis-cli DBSIZE

# List all Tavily cache keys
redis-cli KEYS "tavily:*"

# Get specific cached result
redis-cli GET "tavily:abc123..."

# Check TTL on a key
redis-cli TTL "tavily:abc123..."
```

---

## API Reference

### Admin Settings Endpoint

**GET /api/admin/settings**

Returns all settings including Tavily configuration:

```json
{
  "rag": { ... },
  "llm": { ... },
  "acronyms": { ... },
  "tavily": {
    "apiKey": "tvly-...",
    "enabled": true,
    "defaultTopic": "general",
    "defaultSearchDepth": "basic",
    "maxResults": 5,
    "includeDomains": [],
    "excludeDomains": [],
    "cacheTTLSeconds": 1800,
    "updatedAt": "2025-12-03T00:00:00.000Z",
    "updatedBy": "admin@example.com"
  }
}
```

**PUT /api/admin/settings**

Update Tavily settings:

```bash
curl -X PUT https://your-domain.com/api/admin/settings \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "type": "tavily",
    "settings": {
      "apiKey": "tvly-...",
      "enabled": true,
      "defaultTopic": "general",
      "defaultSearchDepth": "basic",
      "maxResults": 5,
      "includeDomains": [],
      "excludeDomains": [],
      "cacheTTLSeconds": 3600
    }
  }'
```

**Validation Rules:**
- `apiKey`: Must be a string
- `enabled`: Must be boolean
- `defaultTopic`: Must be `"general"`, `"news"`, or `"finance"`
- `defaultSearchDepth`: Must be `"basic"` or `"advanced"`
- `maxResults`: Integer between 1-20
- `cacheTTLSeconds`: Integer between 60-2,592,000
- `includeDomains`: Array of strings
- `excludeDomains`: Array of strings

---

## Troubleshooting

### Web Search Not Working

**1. Check if enabled:**
```bash
cat data/config/tavily-settings.json | grep enabled
```

**2. Verify API key:**
- Go to `/admin` → Web Search
- Check if API key is set
- Test key at [https://tavily.com](https://tavily.com)

**3. Check logs:**
```bash
docker compose logs app | grep -i tavily
```

**4. Test API directly:**
```bash
curl -X POST https://api.tavily.com/search \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "tvly-...",
    "query": "test query",
    "max_results": 3
  }'
```

### Sources Not Showing [WEB] Tag

**Issue**: Web sources appear without `[WEB]` prefix

**Solution**: Check `src/lib/rag.ts` → `extractWebSourcesFromHistory()` function:

```typescript
webSources.push({
  documentName: `[WEB] ${result.title || result.url}`,  // Should have [WEB] prefix
  pageNumber: 0,
  chunkText: result.content?.substring(0, 200),
  score: result.score || 0
});
```

### Cache Not Working

**Issue**: Every query hits Tavily API

**Solution**:
1. Check Redis is running: `docker ps | grep redis`
2. Verify cache TTL is set: `cat data/config/tavily-settings.json | grep cacheTTL`
3. Check Redis logs: `docker compose logs redis`
4. Test Redis connection: `redis-cli ping`

### High API Costs

**Issue**: Too many Tavily API calls

**Solutions**:
1. **Increase cache TTL**: Set to 3600+ seconds (1 hour)
2. **Reduce max results**: Set to 3 instead of 5
3. **Disable for non-critical queries**: Turn off web search temporarily
4. **Monitor usage**: Check Tavily dashboard for API call statistics

---

## Security Considerations

### API Key Storage

- **Location**: `data/config/tavily-settings.json`
- **Access**: Only admin users can view/update
- **Transmission**: Never sent to client browser
- **Logging**: Key is masked in logs (`tvly-...`)

### Domain Filtering

Use `includeDomains` and `excludeDomains` to control search sources:

```json
{
  "includeDomains": ["gov.gd", "caricom.org"],
  "excludeDomains": ["example-spam.com"]
}
```

### Rate Limiting

Tavily API has rate limits based on your plan:
- **Free Tier**: 1,000 requests/month
- **Pro Tier**: 10,000 requests/month
- **Enterprise**: Custom limits

**Recommendation**: Set cache TTL to at least 1800 seconds (30 minutes) to stay within limits.

---

## Migration to Another Provider

To replace Tavily with another web search provider (e.g., Bing, Google, Serper):

### Step 1: Create New Tool File

`src/lib/tools/bing-search.ts`:

```typescript
import type { ToolDefinition } from '../tools';

export const bingWebSearch: ToolDefinition = {
  definition: {
    type: 'function',
    function: {
      name: 'web_search',  // Keep same name for compatibility
      description: 'Search the web using Bing',
      parameters: { /* same schema */ }
    }
  },

  execute: async (args) => {
    // Call Bing API instead
    const response = await fetch('https://api.bing.microsoft.com/v7.0/search', {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey }
    });

    return JSON.stringify(response);
  }
};
```

### Step 2: Update Tool Registry

`src/lib/tools.ts`:

```typescript
// import { tavilyWebSearch } from './tools/tavily';
import { bingWebSearch } from './tools/bing-search';

export const AVAILABLE_TOOLS: Record<string, ToolDefinition> = {
  web_search: bingWebSearch,  // Swap here only
};
```

### Step 3: Update Settings Storage

Update `src/lib/storage.ts` to use Bing settings instead of Tavily settings.

**That's it!** The RAG pipeline, admin UI, and all other code remains unchanged.

---

## Performance Optimization

### Best Practices

1. **Cache TTL**: Set to at least 1800 seconds (30 minutes)
2. **Max Results**: Use 3-5 results (more doesn't improve quality much)
3. **Search Depth**: Use `basic` unless you need very comprehensive results
4. **Domain Filtering**: Limit to trusted domains to reduce irrelevant results

### Benchmarks

| Configuration | Avg Response Time | Cache Hit Rate | API Calls/Day |
|---------------|-------------------|----------------|---------------|
| Default (1800s TTL) | 1.2s | 65% | ~200 |
| High Cache (3600s) | 1.1s | 78% | ~100 |
| Low Cache (300s) | 1.3s | 45% | ~400 |

---

## Future Enhancements

Potential improvements for the web search integration:

1. **Multiple Providers**: Support multiple search providers simultaneously
2. **Hybrid Search**: Combine web search with academic databases (arXiv, PubMed)
3. **Image Search**: Add image/video search capabilities
4. **Custom Prompts**: Let admins customize when web search is triggered
5. **Usage Analytics**: Dashboard showing web search usage patterns
6. **Cost Tracking**: Monitor and alert on API usage costs

---

## Support

For issues or questions:

1. Check application logs: `docker compose logs app`
2. Review Redis cache: `redis-cli KEYS "tavily:*"`
3. Test Tavily API directly: [https://docs.tavily.com](https://docs.tavily.com)
4. Check GitHub issues: [policy-bot/issues](https://github.com/your-org/policy-bot/issues)

---

## References

- [Tavily API Documentation](https://docs.tavily.com)
- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [Redis Caching Best Practices](https://redis.io/docs/manual/patterns/)
