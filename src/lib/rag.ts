import { createEmbedding, createEmbeddings, generateResponse } from './openai';
import { queryDocuments } from './chroma';
import { getCachedQuery, cacheQuery, hashQuery } from './redis';
import { extractTextFromPDF, chunkText } from './ingest';
import { readFileBuffer } from './storage';
import type { Message, Source, RetrievedChunk, RAGResponse } from '@/types';

// Retrieval configuration
const TOP_K_CHUNKS = 15; // Number of chunks to retrieve per query
const MAX_CONTEXT_CHUNKS = 12; // Maximum chunks to include in final context
const SIMILARITY_THRESHOLD = 0.3; // Minimum similarity score to include

const SYSTEM_PROMPT = `You are a helpful policy assistant for government staff. Your role is to:

1. Answer questions based ONLY on the provided context from policy documents
2. When comparing documents for compliance, clearly identify areas of alignment and gaps
3. Always cite which document and section your answer comes from
4. If the context doesn't contain enough information to answer, say so clearly
5. Be concise, professional, and accurate

When citing sources, use this format: [Document Name, Page X]

If a user asks you to compare their uploaded document against policies:
- Identify specific sections that align with policies
- Point out any gaps or areas that don't meet policy requirements
- Suggest improvements if applicable`;

/**
 * Generate expanded queries to improve retrieval coverage
 */
async function expandQueries(originalQuery: string): Promise<string[]> {
  const queries = [originalQuery];

  // Extract key terms and create variations
  const lowerQuery = originalQuery.toLowerCase();

  // Add acronym expansions common in government/policy docs
  const acronymExpansions: Record<string, string> = {
    'ea': 'enterprise architecture',
    'dta': 'digital transformation agency',
    'it': 'information technology',
    'ict': 'information and communication technology',
    'hr': 'human resources',
    'kpi': 'key performance indicator',
    'sla': 'service level agreement',
  };

  for (const [acronym, expansion] of Object.entries(acronymExpansions)) {
    if (lowerQuery.includes(acronym)) {
      queries.push(originalQuery.replace(new RegExp(acronym, 'gi'), expansion));
    }
    if (lowerQuery.includes(expansion)) {
      queries.push(originalQuery.replace(new RegExp(expansion, 'gi'), acronym.toUpperCase()));
    }
  }

  return queries.slice(0, 3); // Limit to 3 query variations
}

/**
 * Deduplicate chunks based on document and page, keeping highest scored
 */
function deduplicateChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Map<string, RetrievedChunk>();

  for (const chunk of chunks) {
    const key = chunk.id;
    const existing = seen.get(key);

    if (!existing || chunk.score > existing.score) {
      seen.set(key, chunk);
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => b.score - a.score);
}

export async function buildContext(
  queryEmbedding: number[],
  userDocPaths: string[] = [],
  additionalEmbeddings: number[][] = []
): Promise<{ globalChunks: RetrievedChunk[]; userChunks: RetrievedChunk[] }> {
  // Collect all embeddings (original + expanded queries)
  const allEmbeddings = [queryEmbedding, ...additionalEmbeddings];

  // Query with each embedding and collect results
  const allGlobalChunks: RetrievedChunk[] = [];

  for (const embedding of allEmbeddings) {
    const globalResults = await queryDocuments(embedding, TOP_K_CHUNKS, { source: 'global' });

    const chunks: RetrievedChunk[] = globalResults.documents.map((doc, i) => ({
      id: globalResults.ids[i],
      text: doc,
      documentName: globalResults.metadatas[i]?.documentName || 'Unknown',
      pageNumber: globalResults.metadatas[i]?.pageNumber || 1,
      score: 1 - (globalResults.distances[i] || 0), // Convert distance to similarity
      source: 'global' as const,
    }));

    allGlobalChunks.push(...chunks);
  }

  // Deduplicate and filter by similarity threshold
  const globalChunks = deduplicateChunks(allGlobalChunks)
    .filter(chunk => chunk.score >= SIMILARITY_THRESHOLD)
    .slice(0, MAX_CONTEXT_CHUNKS);

  // Process user documents if provided
  const userChunks: RetrievedChunk[] = [];

  for (const docPath of userDocPaths) {
    try {
      const buffer = await readFileBuffer(docPath);
      const { text, pages } = await extractTextFromPDF(buffer);
      const filename = docPath.split('/').pop() || 'user-document.pdf';

      // Create temporary chunks from user document with page info
      const chunks = await chunkText(text, 'user-temp', filename, 'user', undefined, undefined, pages);

      // Get embeddings for user document chunks
      const chunkTexts = chunks.slice(0, 10).map(c => c.text); // Limit to first 10 chunks
      if (chunkTexts.length > 0) {
        const chunkEmbeddings = await createEmbeddings(chunkTexts);

        // Calculate similarity with query
        for (let i = 0; i < chunkTexts.length; i++) {
          const similarity = cosineSimilarity(queryEmbedding, chunkEmbeddings[i]);
          if (similarity >= SIMILARITY_THRESHOLD) {
            userChunks.push({
              id: chunks[i].id,
              text: chunks[i].text,
              documentName: filename,
              pageNumber: chunks[i].metadata.pageNumber,
              score: similarity,
              source: 'user',
            });
          }
        }
      }
    } catch (error) {
      console.error(`Failed to process user document: ${docPath}`, error);
    }
  }

  // Sort user chunks by relevance
  userChunks.sort((a, b) => b.score - a.score);

  return { globalChunks, userChunks: userChunks.slice(0, 5) };
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

function formatContext(globalChunks: RetrievedChunk[], userChunks: RetrievedChunk[]): string {
  let context = '';

  if (globalChunks.length > 0) {
    context += '=== POLICY DOCUMENTS ===\n\n';
    for (const chunk of globalChunks) {
      context += `[Source: ${chunk.documentName}, Page ${chunk.pageNumber}]\n`;
      context += `${chunk.text}\n\n---\n\n`;
    }
  }

  if (userChunks.length > 0) {
    context += '=== USER UPLOADED DOCUMENT ===\n\n';
    for (const chunk of userChunks) {
      context += `[Source: ${chunk.documentName}, Page ${chunk.pageNumber}]\n`;
      context += `${chunk.text}\n\n---\n\n`;
    }
  }

  if (!context) {
    context = 'No relevant policy documents found.';
  }

  return context;
}

function extractSources(globalChunks: RetrievedChunk[], userChunks: RetrievedChunk[]): Source[] {
  const allChunks = [...globalChunks, ...userChunks];
  return allChunks.map(chunk => ({
    documentName: chunk.documentName,
    pageNumber: chunk.pageNumber,
    chunkText: chunk.text.substring(0, 200) + (chunk.text.length > 200 ? '...' : ''),
    score: chunk.score,
  }));
}

export async function ragQuery(
  userMessage: string,
  conversationHistory: Message[] = [],
  userDocPaths: string[] = []
): Promise<RAGResponse> {
  // Check cache (only for queries without user documents)
  if (userDocPaths.length === 0) {
    const queryHash = hashQuery(userMessage);
    const cached = await getCachedQuery(queryHash);
    if (cached) {
      try {
        return JSON.parse(cached) as RAGResponse;
      } catch {
        // Invalid cache, continue with fresh query
      }
    }
  }

  // Expand query for better retrieval
  const expandedQueries = await expandQueries(userMessage);

  // Create embeddings for all queries
  const allQueryEmbeddings = await createEmbeddings(expandedQueries);
  const primaryEmbedding = allQueryEmbeddings[0];
  const additionalEmbeddings = allQueryEmbeddings.slice(1);

  // Build context from documents using multiple query embeddings
  const { globalChunks, userChunks } = await buildContext(
    primaryEmbedding,
    userDocPaths,
    additionalEmbeddings
  );

  // Format context for LLM
  const context = formatContext(globalChunks, userChunks);

  // Generate response
  const answer = await generateResponse(
    SYSTEM_PROMPT,
    conversationHistory,
    context,
    userMessage
  );

  // Extract sources
  const sources = extractSources(globalChunks, userChunks);

  const response: RAGResponse = { answer, sources };

  // Cache response (only for queries without user documents)
  if (userDocPaths.length === 0) {
    const queryHash = hashQuery(userMessage);
    await cacheQuery(queryHash, JSON.stringify(response));
  }

  return response;
}
