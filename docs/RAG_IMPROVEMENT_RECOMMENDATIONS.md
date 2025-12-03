# RAG System Improvement Recommendations

## Executive Summary
The current RAG system has hardcoded "policy" terminology throughout, limiting its ability to retrieve non-policy documents (e.g., design documents, guidelines, standards). This document outlines issues and provides actionable recommendations.

---

## Issues Identified

### 1. Hardcoded "Policy" References (HIGH PRIORITY)

#### Problem
The system explicitly references "policy documents" in multiple locations, which:
- Biases the LLM to only look for policy-related content
- Creates misleading error messages ("No relevant policy documents found")
- Limits the system's applicability to other document types

#### Affected Files
- `src/lib/rag.ts:160, 176` - Context formatting
- `src/lib/openai.ts:73, 145` - Prompt construction
- `src/lib/storage.ts:124` - System prompt
- `src/lib/tools/tavily.ts:14` - Web search tool description
- `src/lib/chroma.ts:4` - Collection name

#### Impact on Your Use Case
When you ask "what is DTA?", the system:
1. Searches with a bias toward "policy" content
2. LLM is instructed to only consider "policy documents"
3. May miss design/architecture documents even if they're indexed
4. Returns "No relevant policy documents found" even if DTA docs exist

---

### 2. RAG Configuration Issues

#### Current Settings
```typescript
{
  topKChunks: 15,              // Chunks retrieved per query
  maxContextChunks: 12,        // Chunks sent to LLM
  similarityThreshold: 0.3,    // 30% minimum similarity
  chunkSize: 500,              // Characters per chunk
  chunkOverlap: 50,            // Overlap between chunks
}
```

#### Issues
- **Similarity threshold too low (0.3)**: May include irrelevant content
- **Limited context (12 chunks)**: May miss relevant information in large documents
- **Small chunk size (500 chars)**: May fragment important context
- **Low overlap (50 chars)**: May miss concepts split across chunks

---

### 3. Query Processing Limitations

#### Current Approach
- Only 3 query variations generated
- Expansion focused on acronyms only
- No semantic query enhancement
- No query intent classification

#### Missing Capabilities
- No handling of multi-hop questions
- No document type awareness
- No temporal filtering
- No source prioritization

---

### 4. No Metadata-Based Filtering

#### Current Limitation
All documents searched equally, regardless of:
- Document type (policy, design, guideline, standard)
- Document age/version
- Document category/domain
- Document authority level

---

## Recommended Solutions

### Solution 1: Make System Document-Type Agnostic (QUICK WIN)

#### Changes Required

**1.1 Update Context Formatting** (`src/lib/rag.ts:156-180`)

**Before:**
```typescript
function formatContext(globalChunks: RetrievedChunk[], userChunks: RetrievedChunk[]): string {
  let context = '';

  if (globalChunks.length > 0) {
    context += '=== POLICY DOCUMENTS ===\n\n';
    // ...
  }

  if (!context) {
    context = 'No relevant policy documents found.';
  }

  return context;
}
```

**After:**
```typescript
function formatContext(globalChunks: RetrievedChunk[], userChunks: RetrievedChunk[]): string {
  let context = '';

  if (globalChunks.length > 0) {
    context += '=== KNOWLEDGE BASE DOCUMENTS ===\n\n';
    // OR: '=== ORGANIZATIONAL DOCUMENTS ===\n\n'
    // OR: '=== REFERENCE DOCUMENTS ===\n\n'
    // ...
  }

  if (!context) {
    context = 'No relevant documents found in the knowledge base.';
  }

  return context;
}
```

**1.2 Update Prompt Construction** (`src/lib/openai.ts`)

**Before:**
```typescript
content: `Policy Documents Context:\n${context}\n\n---\n\nQuestion: ${userMessage}`,
```

**After:**
```typescript
content: `Organizational Knowledge Base:\n${context}\n\n---\n\nQuestion: ${userMessage}`,
```

**1.3 Update System Prompt** (`src/lib/storage.ts:122-135`)

**Before:**
```typescript
const DEFAULT_SYSTEM_PROMPT = `You are a helpful policy assistant for government staff. Your role is to:

1. Answer questions based ONLY on the provided context from policy documents
2. When comparing documents for compliance, clearly identify areas of alignment and gaps
3. Always cite which document and section your answer comes from
...`;
```

**After:**
```typescript
const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant for government staff. Your role is to:

1. Answer questions based ONLY on the provided context from organizational documents
2. Consider all document types: policies, design documents, guidelines, standards, and procedures
3. When comparing documents, clearly identify areas of alignment and gaps
4. Always cite which document and section your answer comes from
...`;
```

**1.4 Update Collection Name** (`src/lib/chroma.ts:4`)

**Before:**
```typescript
const COLLECTION_NAME = 'policy_documents';
```

**After:**
```typescript
const COLLECTION_NAME = 'organizational_documents';
```

**Note:** This requires re-indexing all documents or migrating the collection.

**1.5 Update UI Labels** (`src/app/admin/page.tsx:863`)

**Before:**
```typescript
<h2>Policy Documents</h2>
```

**After:**
```typescript
<h2>Knowledge Base Documents</h2>
```

---

### Solution 2: Improve RAG Settings (MEDIUM PRIORITY)

#### Recommended Settings Changes

```typescript
export const DEFAULT_RAG_SETTINGS = {
  topKChunks: 20,              // ↑ from 15 - retrieve more candidates
  maxContextChunks: 15,        // ↑ from 12 - send more context to LLM
  similarityThreshold: 0.5,    // ↑ from 0.3 - higher quality matches
  chunkSize: 800,              // ↑ from 500 - preserve more context
  chunkOverlap: 150,           // ↑ from 50 - better continuity
  queryExpansionEnabled: true,
  cacheEnabled: true,
  cacheTTLSeconds: 3600,
};
```

#### Rationale
- **Higher similarity threshold**: Focus on truly relevant chunks
- **Larger chunks**: Reduce fragmentation of concepts
- **More overlap**: Ensure concepts aren't split
- **More context to LLM**: Provide richer information

---

### Solution 3: Enhanced Query Processing (ADVANCED)

#### 3.1 Add Document Type Detection

```typescript
// New function in src/lib/rag.ts
function detectDocumentTypeIntent(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const types: string[] = [];

  if (lowerQuery.match(/policy|procedure|requirement|must|shall/)) {
    types.push('policy');
  }
  if (lowerQuery.match(/design|architecture|technical|implementation/)) {
    types.push('design');
  }
  if (lowerQuery.match(/guideline|best practice|recommendation|should/)) {
    types.push('guideline');
  }
  if (lowerQuery.match(/standard|specification|format/)) {
    types.push('standard');
  }

  return types.length > 0 ? types : ['all'];
}
```

#### 3.2 Expand Query Variations

**Current:** Only acronym expansion (3 variations)

**Enhanced:**
```typescript
async function expandQueries(originalQuery: string, enabled: boolean): Promise<string[]> {
  const queries = [originalQuery];

  if (!enabled) return queries;

  // 1. Acronym expansion (existing)
  // ... existing code ...

  // 2. Add contextual variations
  const lowerQuery = originalQuery.toLowerCase();

  // 2.1 Add "what/where/how" variations
  if (!lowerQuery.startsWith('what ')) {
    queries.push(`What is ${originalQuery}?`);
  }
  if (!lowerQuery.includes('document')) {
    queries.push(`${originalQuery} documentation`);
  }

  // 2.2 Add organizational context
  queries.push(`${originalQuery} in our organization`);

  return queries.slice(0, 5); // ↑ from 3
}
```

---

### Solution 4: Add Metadata Filtering (ADVANCED)

#### 4.1 Extend Chunk Metadata

```typescript
// src/types.ts - Add to ChunkMetadata
export interface ChunkMetadata {
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  source: 'global' | 'user';
  threadId?: string;
  userId?: string;

  // NEW FIELDS:
  documentType?: 'policy' | 'design' | 'guideline' | 'standard' | 'procedure' | 'other';
  category?: string;           // e.g., 'HR', 'IT', 'Finance', 'Architecture'
  version?: string;            // e.g., 'v1.2', '2024-01'
  effectiveDate?: string;      // ISO date string
  tags?: string[];             // e.g., ['DTA', 'architecture', 'cloud']
}
```

#### 4.2 Update Ingestion to Capture Metadata

```typescript
// src/lib/ingest.ts - Add parameter
export async function ingestDocument(
  buffer: Buffer,
  filename: string,
  uploadedBy: string,
  metadata?: {
    documentType?: string;
    category?: string;
    version?: string;
    tags?: string[];
  }
): Promise<GlobalDocument> {
  // ... existing code ...

  // Pass metadata to chunks
  const chunks = await chunkText(
    text,
    docId,
    filename,
    'global',
    undefined,
    undefined,
    pages,
    metadata  // NEW
  );
}
```

#### 4.3 Add Filtered Query Support

```typescript
// src/lib/rag.ts - Update buildContext
export async function buildContext(
  queryEmbedding: number[],
  userDocPaths: string[] = [],
  additionalEmbeddings: number[][] = [],
  settings?: { ... },
  filters?: {
    documentType?: string[];
    category?: string[];
    tags?: string[];
  }
): Promise<{ globalChunks: RetrievedChunk[]; userChunks: RetrievedChunk[] }> {
  // ... existing code ...

  // Build Chroma where filter
  const whereFilter = filters ? {
    $or: [
      { documentType: { $in: filters.documentType } },
      { category: { $in: filters.category } },
      { tags: { $in: filters.tags } }
    ]
  } : { source: 'global' };

  const globalResults = await queryDocuments(
    embedding,
    topKChunks,
    whereFilter
  );
}
```

---

### Solution 5: Improve Web Search Integration (QUICK WIN)

#### Update Tool Description

**Location:** `src/lib/tools/tavily.ts:14`

**Before:**
```typescript
description: 'Search the web for current information, news, or data not available in policy documents.'
```

**After:**
```typescript
description: 'Search the web for current information, news, or data not available in the organizational knowledge base. Use when internal documents do not contain the answer.'
```

---

### Solution 6: Add Search Quality Diagnostics

#### 6.1 Add Debug Logging

```typescript
// src/lib/rag.ts - Add to buildContext
export async function buildContext(...) {
  // ... existing code ...

  console.log('[RAG DEBUG] Query embedding created');
  console.log('[RAG DEBUG] Retrieved chunks:', {
    total: allGlobalChunks.length,
    afterDedup: globalChunks.length,
    aboveThreshold: globalChunks.filter(c => c.score >= similarityThreshold).length,
    topScores: globalChunks.slice(0, 5).map(c => c.score)
  });

  // ... rest of code ...
}
```

#### 6.2 Add Search Analytics Endpoint

```typescript
// src/app/api/admin/search-analytics/route.ts
export async function GET() {
  // Return search quality metrics:
  // - Average similarity scores
  // - Queries with no results
  // - Most/least retrieved documents
  // - Common query patterns
}
```

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 hours)
1. ✅ Remove all hardcoded "policy" references
2. ✅ Update UI labels to be document-type agnostic
3. ✅ Improve default RAG settings
4. ✅ Add debug logging

### Phase 2: Medium Priority (3-5 hours)
1. ⚠️ Enhance query expansion logic
2. ⚠️ Add document type detection
3. ⚠️ Improve system prompt for better retrieval

### Phase 3: Advanced Features (1-2 days)
1. 🔧 Add metadata fields and filtering
2. 🔧 Create admin UI for document metadata
3. 🔧 Add search analytics dashboard
4. 🔧 Implement document type auto-classification

---

## Testing Recommendations

### After Phase 1 Changes

1. **Reindex Documents**
   - If changing collection name, migrate or reindex
   - Test with existing documents

2. **Test Query Types**
   - Policy questions: "What is the leave policy?"
   - Design questions: "What is DTA?" ← Your failing case
   - Guideline questions: "Best practices for architecture?"
   - Multi-type: "How does the DTA policy define architecture?"

3. **Measure Improvements**
   - Track queries returning no results
   - Monitor average similarity scores
   - Collect user feedback

---

## Expected Outcomes

### Before Changes (Current State)
- Query: "What is DTA?"
- Context: "No relevant policy documents found"
- Reason: System biased toward policy content

### After Phase 1 Changes
- Query: "What is DTA?"
- Context: Retrieves DTA design/policy documents
- Reason: System searches all document types equally

### After Phase 2-3 Changes
- Query: "What is DTA?"
- Context: Retrieves DTA docs + related architecture docs
- Reason: Enhanced query expansion and metadata filtering

---

## Migration Notes

### If Changing Collection Name

**Option A: Migrate Existing Collection**
```typescript
// One-time migration script
import { getChromaClient } from './lib/chroma';

async function migrateCollection() {
  const client = await getChromaClient();

  // 1. Get old collection
  const oldCollection = await client.getCollection({ name: 'policy_documents' });
  const allData = await oldCollection.get();

  // 2. Create new collection
  const newCollection = await client.createCollection({
    name: 'organizational_documents',
    metadata: { 'hnsw:space': 'cosine' }
  });

  // 3. Add all data to new collection
  await newCollection.add({
    ids: allData.ids,
    embeddings: allData.embeddings,
    documents: allData.documents,
    metadatas: allData.metadatas
  });

  // 4. Delete old collection (optional)
  await client.deleteCollection({ name: 'policy_documents' });
}
```

**Option B: Use Environment Variable**
```typescript
// src/lib/chroma.ts
const COLLECTION_NAME = process.env.CHROMA_COLLECTION_NAME || 'organizational_documents';
```

---

## Monitoring & Maintenance

### Key Metrics to Track
1. **Retrieval Quality**
   - Average similarity scores
   - Percentage of queries with no results
   - User feedback on answer quality

2. **Performance**
   - Query latency (embedding + retrieval + LLM)
   - Cache hit rate
   - Token usage per query

3. **Document Coverage**
   - Documents never retrieved
   - Most/least used documents
   - Document type distribution

### Regular Reviews
- Weekly: Check queries with no results
- Monthly: Review and update system prompt
- Quarterly: Optimize RAG settings based on usage patterns

---

## Questions for Consideration

1. **Document Classification**: Should documents be manually tagged or auto-classified?
2. **Collection Strategy**: Single collection vs. multiple collections per doc type?
3. **Acronym Management**: Where are acronym mappings maintained? (Currently in storage.ts)
4. **Search Scope**: Should users be able to filter by document type in the UI?
5. **Version Control**: How should document versions be handled?

---

## Additional Resources

- [Chroma Metadata Filtering Docs](https://docs.trychroma.com/usage-guide#filtering-by-metadata)
- [LangChain Text Splitters](https://python.langchain.com/docs/modules/data_connection/document_transformers/)
- [OpenAI Embeddings Best Practices](https://platform.openai.com/docs/guides/embeddings/use-cases)
