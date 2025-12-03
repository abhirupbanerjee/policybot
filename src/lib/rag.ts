import { createEmbeddings, generateResponseWithTools } from './openai';
import type { OpenAI } from 'openai';
import { queryDocuments } from './chroma';
import { getCachedQuery, cacheQuery, hashQuery } from './redis';
import { extractTextFromPDF, chunkText } from './ingest';
import { readFileBuffer, getSystemPrompt, getRAGSettings, getAcronymMappings } from './storage';
import type { Message, Source, RetrievedChunk, RAGResponse } from '@/types';

/**
 * Generate expanded queries to improve retrieval coverage
 */
async function expandQueries(originalQuery: string, enabled: boolean): Promise<string[]> {
  const queries = [originalQuery];

  if (!enabled) {
    return queries;
  }

  // Extract key terms and create variations
  const lowerQuery = originalQuery.toLowerCase();

  // Get acronym mappings from storage
  const acronymConfig = await getAcronymMappings();
  const acronymExpansions = acronymConfig.mappings;

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
  additionalEmbeddings: number[][] = [],
  settings?: { topKChunks: number; maxContextChunks: number; similarityThreshold: number }
): Promise<{ globalChunks: RetrievedChunk[]; userChunks: RetrievedChunk[] }> {
  // Use provided settings or fetch from storage
  const ragSettings = settings || await getRAGSettings();
  const { topKChunks, maxContextChunks, similarityThreshold } = ragSettings;

  // Collect all embeddings (original + expanded queries)
  const allEmbeddings = [queryEmbedding, ...additionalEmbeddings];

  // Query with each embedding and collect results
  const allGlobalChunks: RetrievedChunk[] = [];

  for (const embedding of allEmbeddings) {
    const globalResults = await queryDocuments(embedding, topKChunks, { source: 'global' });

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
    .filter(chunk => chunk.score >= similarityThreshold)
    .slice(0, maxContextChunks);

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
          if (similarity >= similarityThreshold) {
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
    context += '=== KNOWLEDGE BASE DOCUMENTS ===\n\n';
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
    context = 'No relevant documents found in the knowledge base.';
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
  // Get RAG settings
  const ragSettings = await getRAGSettings();
  const { cacheEnabled, cacheTTLSeconds, queryExpansionEnabled } = ragSettings;

  // Check cache (only for queries without user documents and if caching is enabled)
  if (cacheEnabled && userDocPaths.length === 0) {
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

  // Expand query for better retrieval (if enabled)
  const expandedQueries = await expandQueries(userMessage, queryExpansionEnabled);

  // Create embeddings for all queries
  const allQueryEmbeddings = await createEmbeddings(expandedQueries);
  const primaryEmbedding = allQueryEmbeddings[0];
  const additionalEmbeddings = allQueryEmbeddings.slice(1);

  // Build context from documents using multiple query embeddings
  const { globalChunks, userChunks } = await buildContext(
    primaryEmbedding,
    userDocPaths,
    additionalEmbeddings,
    ragSettings
  );

  // Format context for LLM
  const context = formatContext(globalChunks, userChunks);

  // Get system prompt from storage
  const systemPromptConfig = await getSystemPrompt();

  // Generate response with tools (web search)
  const { content: answer, fullHistory } = await generateResponseWithTools(
    systemPromptConfig.prompt,
    conversationHistory,
    context,
    userMessage,
    true // Enable tools (web search)
  );

  // Extract sources from RAG
  const sources = extractSources(globalChunks, userChunks);

  // Extract web sources from tool call results
  const webSources = extractWebSourcesFromHistory(fullHistory);
  sources.push(...webSources);

  const response: RAGResponse = { answer, sources };

  // Cache response (only for queries without user documents and if caching is enabled)
  if (cacheEnabled && userDocPaths.length === 0) {
    const queryHash = hashQuery(userMessage);
    await cacheQuery(queryHash, JSON.stringify(response), cacheTTLSeconds);
  }

  return response;
}

/**
 * Extract web search sources from tool call history
 */
function extractWebSourcesFromHistory(
  history: OpenAI.Chat.ChatCompletionMessageParam[]
): Source[] {
  const webSources: Source[] = [];

  for (const msg of history) {
    if (msg.role === 'tool') {
      try {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        const toolResult = JSON.parse(content);

        if (toolResult.results && Array.isArray(toolResult.results)) {
          for (const result of toolResult.results) {
            webSources.push({
              documentName: `[WEB] ${result.title || result.url}`,
              pageNumber: 0, // N/A for web results
              chunkText: result.content?.substring(0, 200) || '',
              score: result.score || 0,
            });
          }
        }
      } catch (error) {
        // Ignore JSON parse errors
        console.warn('Failed to parse tool result as web search:', error);
      }
    }
  }

  return webSources;
}
