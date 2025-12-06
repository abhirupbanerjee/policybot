/**
 * Reranker Module
 *
 * Supports dual providers:
 * - Cohere API (fast, requires API key)
 * - Local @xenova/transformers (free, slower first load)
 *
 * Includes Redis caching for performance.
 */

import { getRerankerSettings } from './db/config';
import { getCachedQuery, cacheQuery, hashQuery } from './redis';
import type { RetrievedChunk } from '@/types';

// Cohere rerank result type
interface CohereRerankResult {
  index: number;
  relevanceScore: number;
}

// Cohere client interface (subset of what we use)
interface CohereClientInterface {
  rerank(params: {
    query: string;
    documents: { text: string }[];
    model: string;
    topN: number;
  }): Promise<{ results: CohereRerankResult[] }>;
}

// Lazy-loaded Cohere client
let cohereClient: CohereClientInterface | null = null;

/**
 * Get or create Cohere client
 */
async function getCohereClient(): Promise<CohereClientInterface> {
  if (cohereClient) return cohereClient;

  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    throw new Error('COHERE_API_KEY environment variable is not set');
  }

  const { CohereClient } = await import('cohere-ai');
  cohereClient = new CohereClient({ token: apiKey }) as CohereClientInterface;
  return cohereClient;
}

/**
 * Rerank chunks using Cohere API
 */
async function rerankWithCohere(
  query: string,
  chunks: RetrievedChunk[],
  minScore: number
): Promise<RetrievedChunk[]> {
  try {
    const client = await getCohereClient();

    const response = await client.rerank({
      query,
      documents: chunks.map(c => ({ text: c.text })),
      model: 'rerank-english-v3.0',
      topN: chunks.length,
    });

    // Map reranker scores back to chunks and filter by minimum score
    const rerankedChunks: RetrievedChunk[] = response.results
      .filter((result) => result.relevanceScore >= minScore)
      .map((result) => ({
        ...chunks[result.index],
        score: result.relevanceScore,
      }));

    return rerankedChunks.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error('[Reranker] Cohere error:', error);
    // Fallback to original chunks on error
    return chunks;
  }
}

/**
 * Rerank chunks using local @xenova/transformers
 * Uses cross-encoder model for reranking
 */
async function rerankWithLocal(
  query: string,
  chunks: RetrievedChunk[],
  minScore: number
): Promise<RetrievedChunk[]> {
  try {
    // Dynamic import for @xenova/transformers
    const { pipeline, env } = await import('@xenova/transformers');

    // Disable local model caching warnings
    env.allowLocalModels = false;

    // Use a cross-encoder model for reranking
    // BGE reranker models work well for this
    const reranker = await pipeline(
      'text-classification',
      'Xenova/ms-marco-MiniLM-L-6-v2',
      { quantized: true }
    );

    // Score each chunk against the query
    const scoredChunks: RetrievedChunk[] = [];

    for (const chunk of chunks) {
      try {
        // Cross-encoder takes query-document pairs
        const result = await reranker(`${query} [SEP] ${chunk.text}`);

        // Extract score from result (handle various output formats)
        let score = 0;
        if (Array.isArray(result) && result.length > 0) {
          const firstResult = result[0] as { score?: number; label?: string };
          score = firstResult.score ?? 0;
        } else if (typeof result === 'object' && result !== null) {
          const singleResult = result as { score?: number };
          score = singleResult.score ?? 0;
        }

        if (score >= minScore) {
          scoredChunks.push({
            ...chunk,
            score,
          });
        }
      } catch (chunkError) {
        console.warn('[Reranker] Error scoring chunk:', chunkError);
        // Keep chunk with original score if reranking fails
        if (chunk.score >= minScore) {
          scoredChunks.push(chunk);
        }
      }
    }

    return scoredChunks.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error('[Reranker] Local reranker error:', error);
    // Fallback to original chunks on error
    return chunks;
  }
}

/**
 * Main reranking function
 *
 * Reranks retrieved chunks using the configured provider.
 * Includes caching for performance.
 *
 * @param query - The user's search query
 * @param chunks - Retrieved chunks from vector search
 * @returns Reranked chunks sorted by relevance
 */
export async function rerankChunks(
  query: string,
  chunks: RetrievedChunk[]
): Promise<RetrievedChunk[]> {
  const settings = getRerankerSettings();

  // Return original chunks if reranker is disabled or no chunks
  if (!settings.enabled || chunks.length === 0) {
    return chunks;
  }

  // Check cache first
  const cacheKey = `reranker:${hashQuery(`${query}:${chunks.map(c => c.id).join(',')}`)}`;

  try {
    const cached = await getCachedQuery(cacheKey);
    if (cached) {
      const cachedScores: number[] = JSON.parse(cached);
      // Apply cached scores to chunks
      return chunks
        .map((chunk, i) => ({
          ...chunk,
          score: cachedScores[i] ?? chunk.score,
        }))
        .filter(c => c.score >= settings.minRerankerScore)
        .sort((a, b) => b.score - a.score);
    }
  } catch {
    // Cache miss or error, continue with reranking
  }

  // Limit chunks to rerank for performance
  const chunksToRerank = chunks.slice(0, settings.topKForReranking);
  const remainingChunks = chunks.slice(settings.topKForReranking);

  console.log(`[Reranker] Reranking ${chunksToRerank.length} chunks with ${settings.provider}`);

  let rerankedChunks: RetrievedChunk[];

  if (settings.provider === 'cohere') {
    rerankedChunks = await rerankWithCohere(
      query,
      chunksToRerank,
      settings.minRerankerScore
    );
  } else {
    rerankedChunks = await rerankWithLocal(
      query,
      chunksToRerank,
      settings.minRerankerScore
    );
  }

  // Cache the scores for future use
  try {
    const scores = chunks.map(chunk => {
      const reranked = rerankedChunks.find(r => r.id === chunk.id);
      return reranked?.score ?? chunk.score;
    });
    await cacheQuery(cacheKey, JSON.stringify(scores), settings.cacheTTLSeconds);
  } catch {
    // Ignore cache errors
  }

  // Combine reranked chunks with remaining (unranked) chunks
  // Filter remaining chunks by the same threshold
  const filteredRemaining = remainingChunks.filter(
    c => c.score >= settings.minRerankerScore
  );

  console.log(`[Reranker] After reranking: ${rerankedChunks.length} chunks passed threshold`);

  return [...rerankedChunks, ...filteredRemaining];
}
