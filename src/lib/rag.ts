import { createEmbedding, generateResponse } from './openai';
import { queryDocuments } from './chroma';
import { getCachedQuery, cacheQuery, hashQuery } from './redis';
import { extractTextFromPDF, chunkText } from './ingest';
import { readFileBuffer } from './storage';
import type { Message, Source, RetrievedChunk, RAGResponse } from '@/types';

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

export async function buildContext(
  queryEmbedding: number[],
  userDocPaths: string[] = []
): Promise<{ globalChunks: RetrievedChunk[]; userChunks: RetrievedChunk[] }> {
  // Query global policy documents
  const globalResults = await queryDocuments(queryEmbedding, 5, { source: 'global' });

  const globalChunks: RetrievedChunk[] = globalResults.documents.map((doc, i) => ({
    id: globalResults.ids[i],
    text: doc,
    documentName: globalResults.metadatas[i]?.documentName || 'Unknown',
    pageNumber: globalResults.metadatas[i]?.pageNumber || 1,
    score: 1 - (globalResults.distances[i] || 0), // Convert distance to similarity
    source: 'global' as const,
  }));

  // Process user documents if provided
  const userChunks: RetrievedChunk[] = [];

  for (const docPath of userDocPaths) {
    try {
      const buffer = await readFileBuffer(docPath);
      const { text } = await extractTextFromPDF(buffer);
      const filename = docPath.split('/').pop() || 'user-document.pdf';

      // Create temporary chunks from user document
      const chunks = await chunkText(text, 'user-temp', filename, 'user');

      // Find most relevant chunks (simple text matching for now)
      // In production, you might want to embed these too
      for (const chunk of chunks.slice(0, 3)) {
        userChunks.push({
          id: chunk.id,
          text: chunk.text,
          documentName: filename,
          pageNumber: chunk.metadata.pageNumber,
          score: 0.8, // Placeholder score
          source: 'user',
        });
      }
    } catch (error) {
      console.error(`Failed to process user document: ${docPath}`, error);
    }
  }

  return { globalChunks, userChunks };
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

  // Create query embedding
  const queryEmbedding = await createEmbedding(userMessage);

  // Build context from documents
  const { globalChunks, userChunks } = await buildContext(queryEmbedding, userDocPaths);

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
