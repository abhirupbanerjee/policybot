/**
 * Workspace Thread Management
 *
 * Handles thread operations for standalone workspace mode.
 * Threads group messages into conversations and are tied to sessions.
 */

import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute, transaction } from './index';
import type {
  WorkspaceThread,
  WorkspaceThreadWithMessages,
  WorkspaceThreadRow,
  CreateWorkspaceThreadInput,
  UpdateWorkspaceThreadInput,
} from '@/types/workspace';
import { getThreadMessages } from './workspace-messages';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert database row to WorkspaceThread object
 */
function rowToThread(row: WorkspaceThreadRow): WorkspaceThread {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    session_id: row.session_id,
    title: row.title,
    is_archived: row.is_archived === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ============================================================================
// Thread CRUD
// ============================================================================

/**
 * Create a new thread
 */
export function createThread(
  workspaceId: string,
  sessionId: string,
  input: CreateWorkspaceThreadInput = {}
): WorkspaceThread {
  const id = uuidv4();
  const title = input.title || 'New Chat';

  execute(
    `INSERT INTO workspace_threads (id, workspace_id, session_id, title)
     VALUES (?, ?, ?, ?)`,
    [id, workspaceId, sessionId, title]
  );

  return getThread(id)!;
}

/**
 * Get thread by ID
 */
export function getThread(threadId: string): WorkspaceThread | null {
  const row = queryOne<WorkspaceThreadRow>(
    'SELECT * FROM workspace_threads WHERE id = ?',
    [threadId]
  );
  return row ? rowToThread(row) : null;
}

/**
 * Get thread with messages
 */
export function getThreadWithMessages(threadId: string): WorkspaceThreadWithMessages | null {
  const thread = getThread(threadId);
  if (!thread) return null;

  const messages = getThreadMessages(threadId);
  return {
    ...thread,
    messages,
    message_count: messages.length,
  };
}

/**
 * Get thread with validation that it belongs to the session
 */
export function getThreadForSession(
  threadId: string,
  sessionId: string
): WorkspaceThread | null {
  const row = queryOne<WorkspaceThreadRow>(
    'SELECT * FROM workspace_threads WHERE id = ? AND session_id = ?',
    [threadId, sessionId]
  );
  return row ? rowToThread(row) : null;
}

/**
 * Update thread
 */
export function updateThread(
  threadId: string,
  updates: UpdateWorkspaceThreadInput
): WorkspaceThread | null {
  const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const params: unknown[] = [];

  if (updates.title !== undefined) {
    setClauses.push('title = ?');
    params.push(updates.title);
  }
  if (updates.is_archived !== undefined) {
    setClauses.push('is_archived = ?');
    params.push(updates.is_archived ? 1 : 0);
  }

  if (setClauses.length === 1) {
    // Only updated_at, no actual updates
    return getThread(threadId);
  }

  params.push(threadId);

  execute(
    `UPDATE workspace_threads SET ${setClauses.join(', ')} WHERE id = ?`,
    params
  );

  return getThread(threadId);
}

/**
 * Delete thread (and cascade delete messages)
 */
export function deleteThread(threadId: string): boolean {
  const result = execute(
    'DELETE FROM workspace_threads WHERE id = ?',
    [threadId]
  );
  return result.changes > 0;
}

/**
 * Archive/unarchive thread
 */
export function archiveThread(threadId: string, archived: boolean = true): WorkspaceThread | null {
  return updateThread(threadId, { is_archived: archived });
}

/**
 * Update thread title
 */
export function updateThreadTitle(threadId: string, title: string): WorkspaceThread | null {
  return updateThread(threadId, { title });
}

/**
 * Touch thread (update updated_at timestamp)
 */
export function touchThread(threadId: string): void {
  execute(
    'UPDATE workspace_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [threadId]
  );
}

// ============================================================================
// Thread Queries
// ============================================================================

/**
 * Get all threads for a session (standalone mode)
 */
export function getSessionThreads(
  sessionId: string,
  options: {
    includeArchived?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): WorkspaceThread[] {
  const { includeArchived = false, limit = 50, offset = 0 } = options;

  const whereClause = includeArchived
    ? 'WHERE session_id = ?'
    : 'WHERE session_id = ? AND is_archived = 0';

  const rows = queryAll<WorkspaceThreadRow>(
    `SELECT * FROM workspace_threads ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [sessionId, limit, offset]
  );

  return rows.map(rowToThread);
}

/**
 * Get threads for a workspace
 */
export function getWorkspaceThreads(
  workspaceId: string,
  options: {
    includeArchived?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): WorkspaceThread[] {
  const { includeArchived = false, limit = 100, offset = 0 } = options;

  const whereClause = includeArchived
    ? 'WHERE workspace_id = ?'
    : 'WHERE workspace_id = ? AND is_archived = 0';

  const rows = queryAll<WorkspaceThreadRow>(
    `SELECT * FROM workspace_threads ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [workspaceId, limit, offset]
  );

  return rows.map(rowToThread);
}

/**
 * Get most recent thread for a session
 */
export function getLatestThread(sessionId: string): WorkspaceThread | null {
  const row = queryOne<WorkspaceThreadRow>(
    `SELECT * FROM workspace_threads
     WHERE session_id = ? AND is_archived = 0
     ORDER BY updated_at DESC LIMIT 1`,
    [sessionId]
  );
  return row ? rowToThread(row) : null;
}

/**
 * Get or create a thread for a session
 * Returns the most recent active thread or creates a new one
 */
export function getOrCreateThread(
  workspaceId: string,
  sessionId: string
): WorkspaceThread {
  const existing = getLatestThread(sessionId);
  if (existing) return existing;
  return createThread(workspaceId, sessionId);
}

/**
 * Search threads by title
 */
export function searchThreads(
  sessionId: string,
  query: string,
  limit: number = 20
): WorkspaceThread[] {
  const searchPattern = `%${query}%`;
  const rows = queryAll<WorkspaceThreadRow>(
    `SELECT * FROM workspace_threads
     WHERE session_id = ? AND title LIKE ?
     ORDER BY updated_at DESC LIMIT ?`,
    [sessionId, searchPattern, limit]
  );
  return rows.map(rowToThread);
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Archive all threads for a session
 */
export function archiveAllSessionThreads(sessionId: string): number {
  const result = execute(
    'UPDATE workspace_threads SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND is_archived = 0',
    [sessionId]
  );
  return result.changes;
}

/**
 * Delete all threads for a session
 */
export function deleteSessionThreads(sessionId: string): number {
  const result = execute(
    'DELETE FROM workspace_threads WHERE session_id = ?',
    [sessionId]
  );
  return result.changes;
}

/**
 * Delete all threads for a workspace
 */
export function deleteWorkspaceThreads(workspaceId: string): number {
  const result = execute(
    'DELETE FROM workspace_threads WHERE workspace_id = ?',
    [workspaceId]
  );
  return result.changes;
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get thread count for a session
 */
export function getSessionThreadCount(
  sessionId: string,
  includeArchived: boolean = false
): number {
  const whereClause = includeArchived
    ? 'WHERE session_id = ?'
    : 'WHERE session_id = ? AND is_archived = 0';

  const result = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM workspace_threads ${whereClause}`,
    [sessionId]
  );
  return result?.count || 0;
}

/**
 * Get thread count for a workspace
 */
export function getWorkspaceThreadCount(workspaceId: string): number {
  const result = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM workspace_threads WHERE workspace_id = ?',
    [workspaceId]
  );
  return result?.count || 0;
}

/**
 * Get message count for a thread
 */
export function getThreadMessageCount(threadId: string): number {
  const result = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM workspace_messages WHERE thread_id = ?',
    [threadId]
  );
  return result?.count || 0;
}

/**
 * Auto-generate title from first message
 */
export function autoTitleThread(threadId: string, maxLength: number = 50): string | null {
  const firstMessage = queryOne<{ content: string }>(
    `SELECT content FROM workspace_messages
     WHERE thread_id = ? AND role = 'user'
     ORDER BY created_at ASC LIMIT 1`,
    [threadId]
  );

  if (!firstMessage) return null;

  // Clean up and truncate content for title
  let title = firstMessage.content
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

  if (firstMessage.content.length > maxLength) {
    title += '...';
  }

  updateThreadTitle(threadId, title);
  return title;
}
