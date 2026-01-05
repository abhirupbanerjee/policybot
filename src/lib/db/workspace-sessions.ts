/**
 * Workspace Session Management
 *
 * Handles session creation and management for both embed and standalone modes.
 * - Embed: Ephemeral sessions with expiry (24 hours)
 * - Standalone: Persistent sessions tied to authenticated users
 */

import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute, transaction } from './index';
import type { WorkspaceSession, WorkspaceSessionRow } from '@/types/workspace';

// ============================================================================
// Constants
// ============================================================================

const EMBED_SESSION_TTL_HOURS = 24;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert database row to WorkspaceSession object
 */
function rowToSession(row: WorkspaceSessionRow): WorkspaceSession {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    visitor_id: row.visitor_id,
    user_id: row.user_id,
    referrer_url: row.referrer_url,
    ip_hash: row.ip_hash,
    message_count: row.message_count,
    started_at: row.started_at,
    last_activity: row.last_activity,
    expires_at: row.expires_at,
  };
}

// ============================================================================
// Session CRUD
// ============================================================================

/**
 * Create a new session for a workspace
 */
export function createSession(
  workspaceId: string,
  options: {
    userId?: number;
    visitorId?: string;
    referrerUrl?: string;
    ipHash?: string;
    expiresInHours?: number;
  } = {}
): WorkspaceSession {
  const id = uuidv4();
  const {
    userId,
    visitorId,
    referrerUrl,
    ipHash,
    expiresInHours = EMBED_SESSION_TTL_HOURS,
  } = options;

  // For embed mode, set expiry. For standalone (with userId), no expiry
  const expiresAt = userId
    ? null
    : new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  execute(
    `INSERT INTO workspace_sessions (
      id, workspace_id, visitor_id, user_id, referrer_url, ip_hash, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, workspaceId, visitorId || null, userId || null, referrerUrl || null, ipHash || null, expiresAt]
  );

  return getSession(id)!;
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): WorkspaceSession | null {
  const row = queryOne<WorkspaceSessionRow>(
    'SELECT * FROM workspace_sessions WHERE id = ?',
    [sessionId]
  );
  return row ? rowToSession(row) : null;
}

/**
 * Get session with workspace info
 */
export function getSessionWithWorkspace(sessionId: string): (WorkspaceSession & { workspace_type: string }) | null {
  const row = queryOne<WorkspaceSessionRow & { workspace_type: string }>(
    `SELECT ws.*, w.type as workspace_type
     FROM workspace_sessions ws
     INNER JOIN workspaces w ON ws.workspace_id = w.id
     WHERE ws.id = ?`,
    [sessionId]
  );
  return row ? { ...rowToSession(row), workspace_type: row.workspace_type } : null;
}

/**
 * Check if session is valid (exists and not expired)
 */
export function isSessionValid(sessionId: string): boolean {
  const session = getSession(sessionId);
  if (!session) return false;

  // No expiry = always valid (standalone mode)
  if (!session.expires_at) return true;

  // Check if expired
  return new Date(session.expires_at) > new Date();
}

/**
 * Update session last activity timestamp
 */
export function updateSessionActivity(sessionId: string): void {
  execute(
    'UPDATE workspace_sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = ?',
    [sessionId]
  );
}

/**
 * Increment message count for a session
 */
export function incrementMessageCount(sessionId: string): void {
  execute(
    `UPDATE workspace_sessions
     SET message_count = message_count + 1, last_activity = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [sessionId]
  );
}

/**
 * Get session message count
 */
export function getSessionMessageCount(sessionId: string): number {
  const result = queryOne<{ message_count: number }>(
    'SELECT message_count FROM workspace_sessions WHERE id = ?',
    [sessionId]
  );
  return result?.message_count || 0;
}

/**
 * Extend session expiry (for embed mode)
 */
export function extendSessionExpiry(sessionId: string, hours: number = EMBED_SESSION_TTL_HOURS): void {
  const newExpiry = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  execute(
    'UPDATE workspace_sessions SET expires_at = ?, last_activity = CURRENT_TIMESTAMP WHERE id = ?',
    [newExpiry, sessionId]
  );
}

// ============================================================================
// Session Queries
// ============================================================================

/**
 * Get sessions for a workspace
 */
export function getWorkspaceSessions(
  workspaceId: string,
  options: {
    includeExpired?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): WorkspaceSession[] {
  const { includeExpired = false, limit = 100, offset = 0 } = options;

  const whereClause = includeExpired
    ? 'WHERE workspace_id = ?'
    : "WHERE workspace_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))";

  const rows = queryAll<WorkspaceSessionRow>(
    `SELECT * FROM workspace_sessions ${whereClause} ORDER BY last_activity DESC LIMIT ? OFFSET ?`,
    [workspaceId, limit, offset]
  );

  return rows.map(rowToSession);
}

/**
 * Get sessions for a user across all workspaces
 */
export function getUserSessions(userId: number): WorkspaceSession[] {
  const rows = queryAll<WorkspaceSessionRow>(
    'SELECT * FROM workspace_sessions WHERE user_id = ? ORDER BY last_activity DESC',
    [userId]
  );
  return rows.map(rowToSession);
}

/**
 * Get active session for user in a workspace (standalone mode)
 */
export function getUserWorkspaceSession(
  userId: number,
  workspaceId: string
): WorkspaceSession | null {
  const row = queryOne<WorkspaceSessionRow>(
    `SELECT * FROM workspace_sessions
     WHERE user_id = ? AND workspace_id = ?
     ORDER BY last_activity DESC LIMIT 1`,
    [userId, workspaceId]
  );
  return row ? rowToSession(row) : null;
}

/**
 * Get or create session for user in a workspace
 */
export function getOrCreateUserSession(
  userId: number,
  workspaceId: string
): WorkspaceSession {
  const existing = getUserWorkspaceSession(userId, workspaceId);
  if (existing) {
    updateSessionActivity(existing.id);
    return existing;
  }
  return createSession(workspaceId, { userId });
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up expired sessions
 * Returns number of sessions deleted
 */
export function cleanupExpiredSessions(): number {
  const result = execute(
    "DELETE FROM workspace_sessions WHERE expires_at IS NOT NULL AND expires_at < datetime('now')"
  );
  return result.changes;
}

/**
 * Clean up old inactive sessions (even non-expired ones)
 */
export function cleanupInactiveSessions(daysInactive: number = 30): number {
  const cutoff = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000).toISOString();
  const result = execute(
    'DELETE FROM workspace_sessions WHERE last_activity < ?',
    [cutoff]
  );
  return result.changes;
}

/**
 * Delete a specific session
 */
export function deleteSession(sessionId: string): boolean {
  const result = execute(
    'DELETE FROM workspace_sessions WHERE id = ?',
    [sessionId]
  );
  return result.changes > 0;
}

/**
 * Delete all sessions for a workspace
 */
export function deleteWorkspaceSessions(workspaceId: string): number {
  const result = execute(
    'DELETE FROM workspace_sessions WHERE workspace_id = ?',
    [workspaceId]
  );
  return result.changes;
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get session count for a workspace
 */
export function getWorkspaceSessionCount(
  workspaceId: string,
  activeOnly: boolean = true
): number {
  const whereClause = activeOnly
    ? "WHERE workspace_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))"
    : 'WHERE workspace_id = ?';

  const result = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM workspace_sessions ${whereClause}`,
    [workspaceId]
  );
  return result?.count || 0;
}

/**
 * Get unique visitor count for a workspace (last N days)
 */
export function getUniqueVisitorCount(workspaceId: string, days: number = 30): number {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const result = queryOne<{ count: number }>(
    `SELECT COUNT(DISTINCT COALESCE(visitor_id, ip_hash, id)) as count
     FROM workspace_sessions
     WHERE workspace_id = ? AND started_at >= ?`,
    [workspaceId, cutoff]
  );
  return result?.count || 0;
}

/**
 * Get daily session counts for analytics
 */
export function getDailySessionCounts(
  workspaceId: string,
  days: number = 30
): Array<{ date: string; count: number }> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return queryAll<{ date: string; count: number }>(
    `SELECT DATE(started_at) as date, COUNT(*) as count
     FROM workspace_sessions
     WHERE workspace_id = ? AND started_at >= ?
     GROUP BY DATE(started_at)
     ORDER BY date DESC`,
    [workspaceId, cutoff]
  );
}

/**
 * Get comprehensive analytics for a workspace
 */
export function getWorkspaceAnalytics(workspaceId: string, days: number = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Total sessions
  const totalSessions = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM workspace_sessions WHERE workspace_id = ? AND started_at >= ?`,
    [workspaceId, cutoff]
  )?.count || 0;

  // Active sessions (not expired)
  const activeSessions = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM workspace_sessions
     WHERE workspace_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    [workspaceId]
  )?.count || 0;

  // Unique visitors
  const uniqueVisitors = getUniqueVisitorCount(workspaceId, days);

  // Total messages
  const totalMessages = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM workspace_messages WHERE workspace_id = ? AND created_at >= ?`,
    [workspaceId, cutoff]
  )?.count || 0;

  // Average messages per session
  const avgMessagesPerSession = totalSessions > 0 ? Math.round(totalMessages / totalSessions * 10) / 10 : 0;

  // Daily data for charts
  const dailySessions = getDailySessionCounts(workspaceId, days);

  // Daily messages
  const dailyMessages = queryAll<{ date: string; count: number }>(
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM workspace_messages
     WHERE workspace_id = ? AND created_at >= ?
     GROUP BY DATE(created_at)
     ORDER BY date DESC`,
    [workspaceId, cutoff]
  );

  // Average response time (from messages with latency data)
  const avgResponseTime = queryOne<{ avg_latency: number }>(
    `SELECT AVG(latency_ms) as avg_latency FROM workspace_messages
     WHERE workspace_id = ? AND role = 'assistant' AND latency_ms IS NOT NULL AND created_at >= ?`,
    [workspaceId, cutoff]
  )?.avg_latency || 0;

  return {
    summary: {
      totalSessions,
      activeSessions,
      uniqueVisitors,
      totalMessages,
      avgMessagesPerSession,
      avgResponseTimeMs: Math.round(avgResponseTime),
    },
    dailySessions,
    dailyMessages,
  };
}
