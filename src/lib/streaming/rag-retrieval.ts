/**
 * RAG Retrieval for Streaming
 *
 * Extracts the RAG retrieval phase for use in the streaming API.
 * Provides context, sources, and skill information for progressive disclosure.
 */

import type { Source, StreamEvent, SkillInfo } from '@/types';
import type { RetrievedChunk } from '@/types';
import { createEmbeddings } from '../openai';
import { buildContext } from '../rag';
import { rerankChunks } from '../reranker';
import { getRagSettings, getAcronymMappings } from '../db/config';
import { getResolvedSystemPrompt } from '../db/category-prompts';
import { getCategoryIdsBySlugs } from '../db/categories';
import { resolveSkills } from '../skills/resolver';
import { getAvailableDataSourcesDescription } from '../tools/data-source';
import { getToolDefinitions } from '../tools';
import { ragLogger as logger } from '../logger';
import { MAX_QUERY_EXPANSIONS, CHUNK_PREVIEW_LENGTH } from '../constants';

/**
 * Result of RAG retrieval phase
 */
export interface RAGRetrievalResult {
  /** Formatted context string for LLM */
  context: string;
  /** Assembled system prompt with skills, data sources, memory */
  systemPrompt: string;
  /** Extracted sources for citation */
  sources: Source[];
  /** Resolved category IDs */
  categoryIds: number[];
  /** Activated skills for progressive disclosure */
  activatedSkills: SkillInfo[];
  /** Available tool names */
  availableTools: string[];
}

/**
 * Expand queries using acronym mappings
 */
async function expandQueries(originalQuery: string, enabled: boolean): Promise<string[]> {
  const queries = [originalQuery];

  if (!enabled) {
    return queries;
  }

  const lowerQuery = originalQuery.toLowerCase();
  const acronymExpansions = getAcronymMappings();

  for (const [acronym, expansions] of Object.entries(acronymExpansions)) {
    for (const expansion of expansions) {
      if (lowerQuery.includes(acronym.toLowerCase())) {
        queries.push(originalQuery.replace(new RegExp(acronym, 'gi'), expansion));
      }
      if (lowerQuery.includes(expansion.toLowerCase())) {
        queries.push(originalQuery.replace(new RegExp(expansion, 'gi'), acronym.toUpperCase()));
      }
    }
  }

  return queries.slice(0, MAX_QUERY_EXPANSIONS);
}

/**
 * Format chunks into context string for LLM
 */
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

/**
 * Extract source metadata from chunks
 */
function extractSources(globalChunks: RetrievedChunk[], userChunks: RetrievedChunk[]): Source[] {
  const allChunks = [...globalChunks, ...userChunks];
  return allChunks.map(chunk => ({
    documentName: chunk.documentName,
    pageNumber: chunk.pageNumber,
    chunkText: chunk.text.substring(0, CHUNK_PREVIEW_LENGTH) + (chunk.text.length > CHUNK_PREVIEW_LENGTH ? '...' : ''),
    score: chunk.score,
  }));
}

/**
 * Perform RAG retrieval phase
 *
 * Retrieves relevant documents, resolves skills, and builds context.
 * Does NOT execute tools or generate LLM response - that's handled separately.
 *
 * @param userMessage - User's question
 * @param categorySlugs - Category slugs for the thread
 * @param userDocPaths - Paths to user-uploaded documents
 * @param memoryContext - Optional user memory context
 * @param summaryContext - Optional thread summary context
 * @param send - Optional SSE send function for streaming events
 */
export async function performRAGRetrieval(
  userMessage: string,
  categorySlugs: string[] = [],
  userDocPaths: string[] = [],
  memoryContext?: string,
  summaryContext?: string,
  send?: (event: StreamEvent) => void
): Promise<RAGRetrievalResult> {
  const ragSettings = getRagSettings();
  const { queryExpansionEnabled } = ragSettings;

  logger.debug('Starting RAG retrieval', { categorySlugs, userDocPaths: userDocPaths.length });

  // Resolve category IDs
  const categoryIds = categorySlugs.length > 0
    ? getCategoryIdsBySlugs(categorySlugs)
    : [];

  // Expand query for better retrieval
  const expandedQueries = await expandQueries(userMessage, queryExpansionEnabled);

  // Create embeddings for all queries
  const allQueryEmbeddings = await createEmbeddings(expandedQueries);
  const primaryEmbedding = allQueryEmbeddings[0];
  const additionalEmbeddings = allQueryEmbeddings.slice(1);

  // Build context from documents
  const { globalChunks, userChunks } = await buildContext(
    primaryEmbedding,
    userDocPaths,
    additionalEmbeddings,
    ragSettings,
    categorySlugs.length > 0 ? categorySlugs : undefined
  );

  // Apply reranking
  const rerankedGlobalChunks = await rerankChunks(userMessage, globalChunks);
  const rerankedUserChunks = await rerankChunks(userMessage, userChunks);

  // Format context
  const context = formatContext(rerankedGlobalChunks, rerankedUserChunks);

  // Extract sources
  const sources = extractSources(rerankedGlobalChunks, rerankedUserChunks);

  // Build system prompt
  const categoryId = categoryIds[0];
  let systemPrompt = getResolvedSystemPrompt(categoryId);

  // Resolve skills and extract info for progressive disclosure
  const resolvedSkills = resolveSkills(categoryIds, userMessage);
  const activatedSkills: SkillInfo[] = resolvedSkills.skills.map(skill => {
    // Determine trigger reason
    const triggerReason = resolvedSkills.activatedBy.always.includes(skill.name)
      ? 'always'
      : resolvedSkills.activatedBy.keyword.includes(skill.name)
      ? 'keyword'
      : 'category';
    return { name: skill.name, triggerReason };
  });

  if (resolvedSkills.combinedPrompt) {
    systemPrompt = `${systemPrompt}\n\n${resolvedSkills.combinedPrompt}`;
  }

  // Inject data source descriptions
  if (categoryIds.length > 0) {
    const dataSourcesDescription = getAvailableDataSourcesDescription(categoryIds);
    if (dataSourcesDescription) {
      systemPrompt = `${systemPrompt}\n\n${dataSourcesDescription}`;
    }
  }

  // Inject memory context
  if (memoryContext?.trim()) {
    systemPrompt = `${systemPrompt}\n\n${memoryContext}`;
  }

  // Inject summary context
  if (summaryContext?.trim()) {
    systemPrompt = `${systemPrompt}\n\n${summaryContext}`;
  }

  // Get available tools
  const toolDefs = getToolDefinitions(categoryIds);
  const availableTools = toolDefs.map(t => t.function.name);

  // Send context_loaded event for progressive disclosure
  if (send) {
    send({
      type: 'context_loaded',
      skills: activatedSkills,
      toolsAvailable: availableTools,
    });
  }

  logger.debug('RAG retrieval complete', {
    sourcesCount: sources.length,
    skillsCount: activatedSkills.length,
    toolsCount: availableTools.length,
  });

  return {
    context,
    systemPrompt,
    sources,
    categoryIds,
    activatedSkills,
    availableTools,
  };
}
