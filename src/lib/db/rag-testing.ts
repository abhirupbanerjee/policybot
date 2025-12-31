/**
 * RAG Testing Database Operations
 *
 * Handles storage and retrieval of RAG test queries and results
 * for the RAG Tuning Dashboard feature.
 */

import { getDatabase } from './index';

// ============ Types ============

export interface RagTestQuery {
  id: number;
  name: string;
  query: string;
  categoryIds: number[] | null;
  createdBy: string;
  createdAt: string;
}

export interface TopChunk {
  id: string;
  documentName: string;
  text: string;
  score: number;
}

export interface RagTestResult {
  id: number;
  queryId: number | null;
  testQuery: string;
  settingsSnapshot: Record<string, unknown>;
  chunksRetrieved: number;
  avgSimilarity: number;
  latencyMs: number;
  topChunks: TopChunk[];
  createdBy: string;
  createdAt: string;
}

export interface RagTestMetrics {
  chunksRetrieved: number;
  avgSimilarity: number;
  latencyMs: number;
}

// ============ Test Queries ============

/**
 * Create a saved test query
 */
export function createTestQuery(
  name: string,
  query: string,
  categoryIds: number[] | null,
  createdBy: string
): number {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO rag_test_queries (name, query, category_ids, created_by)
    VALUES (?, ?, ?, ?)
  `).run(
    name,
    query,
    categoryIds ? JSON.stringify(categoryIds) : null,
    createdBy
  );
  return result.lastInsertRowid as number;
}

/**
 * Get all saved test queries
 */
export function getAllTestQueries(): RagTestQuery[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT id, name, query, category_ids, created_by, created_at
    FROM rag_test_queries
    ORDER BY created_at DESC
  `).all() as Array<{
    id: number;
    name: string;
    query: string;
    category_ids: string | null;
    created_by: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    query: row.query,
    categoryIds: row.category_ids ? JSON.parse(row.category_ids) : null,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

/**
 * Get a test query by ID
 */
export function getTestQueryById(id: number): RagTestQuery | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT id, name, query, category_ids, created_by, created_at
    FROM rag_test_queries
    WHERE id = ?
  `).get(id) as {
    id: number;
    name: string;
    query: string;
    category_ids: string | null;
    created_by: string;
    created_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    query: row.query,
    categoryIds: row.category_ids ? JSON.parse(row.category_ids) : null,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Delete a test query
 */
export function deleteTestQuery(id: number): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM rag_test_queries WHERE id = ?').run(id);
  return result.changes > 0;
}

// ============ Test Results ============

/**
 * Save a test result
 */
export function saveTestResult(
  queryId: number | null,
  testQuery: string,
  settings: Record<string, unknown>,
  metrics: RagTestMetrics,
  topChunks: TopChunk[],
  createdBy: string
): number {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO rag_test_results (
      query_id, test_query, settings_snapshot,
      chunks_retrieved, avg_similarity, latency_ms,
      top_chunks, created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    queryId,
    testQuery,
    JSON.stringify(settings),
    metrics.chunksRetrieved,
    metrics.avgSimilarity,
    metrics.latencyMs,
    JSON.stringify(topChunks),
    createdBy
  );
  return result.lastInsertRowid as number;
}

/**
 * Get recent test results
 */
export function getRecentResults(limit = 20): RagTestResult[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      id, query_id, test_query, settings_snapshot,
      chunks_retrieved, avg_similarity, latency_ms,
      top_chunks, created_by, created_at
    FROM rag_test_results
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: number;
    query_id: number | null;
    test_query: string;
    settings_snapshot: string;
    chunks_retrieved: number;
    avg_similarity: number;
    latency_ms: number;
    top_chunks: string | null;
    created_by: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    queryId: row.query_id,
    testQuery: row.test_query,
    settingsSnapshot: JSON.parse(row.settings_snapshot),
    chunksRetrieved: row.chunks_retrieved,
    avgSimilarity: row.avg_similarity,
    latencyMs: row.latency_ms,
    topChunks: row.top_chunks ? JSON.parse(row.top_chunks) : [],
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

/**
 * Get results for a specific test query
 */
export function getResultsForQuery(queryId: number, limit = 10): RagTestResult[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      id, query_id, test_query, settings_snapshot,
      chunks_retrieved, avg_similarity, latency_ms,
      top_chunks, created_by, created_at
    FROM rag_test_results
    WHERE query_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(queryId, limit) as Array<{
    id: number;
    query_id: number | null;
    test_query: string;
    settings_snapshot: string;
    chunks_retrieved: number;
    avg_similarity: number;
    latency_ms: number;
    top_chunks: string | null;
    created_by: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    queryId: row.query_id,
    testQuery: row.test_query,
    settingsSnapshot: JSON.parse(row.settings_snapshot),
    chunksRetrieved: row.chunks_retrieved,
    avgSimilarity: row.avg_similarity,
    latencyMs: row.latency_ms,
    topChunks: row.top_chunks ? JSON.parse(row.top_chunks) : [],
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

/**
 * Delete old test results (keep recent N)
 */
export function cleanupOldResults(keepRecent = 100): number {
  const db = getDatabase();
  const result = db.prepare(`
    DELETE FROM rag_test_results
    WHERE id NOT IN (
      SELECT id FROM rag_test_results
      ORDER BY created_at DESC
      LIMIT ?
    )
  `).run(keepRecent);
  return result.changes;
}

/**
 * Get test result statistics
 */
export function getTestStats(): {
  totalTests: number;
  avgLatency: number;
  avgChunksRetrieved: number;
  avgSimilarity: number;
} {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT
      COUNT(*) as total_tests,
      AVG(latency_ms) as avg_latency,
      AVG(chunks_retrieved) as avg_chunks,
      AVG(avg_similarity) as avg_sim
    FROM rag_test_results
  `).get() as {
    total_tests: number;
    avg_latency: number | null;
    avg_chunks: number | null;
    avg_sim: number | null;
  };

  return {
    totalTests: row.total_tests,
    avgLatency: Math.round(row.avg_latency ?? 0),
    avgChunksRetrieved: Math.round((row.avg_chunks ?? 0) * 10) / 10,
    avgSimilarity: Math.round((row.avg_sim ?? 0) * 10000) / 10000,
  };
}
