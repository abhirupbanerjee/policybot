/**
 * Workspace Rate Limiter
 *
 * Rate limiting for embed mode workspaces.
 * Implements per-IP daily limits and per-session limits.
 */

import { queryOne, execute, transaction } from '../db/index';
import { getWorkspaceById } from '../db/workspaces';
import { getSessionMessageCount } from '../db/workspace-sessions';
import type { RateLimitStatus } from '@/types/workspace';

// ============================================================================
// Constants
// ============================================================================

const RATE_LIMIT_WINDOW_HOURS = 24;

// ============================================================================
// Rate Limit Checking
// ============================================================================

/**
 * Check rate limit for a workspace request
 *
 * @param workspaceId - The workspace ID
 * @param ipHash - Hashed IP address
 * @param sessionId - Optional session ID for session-level limits
 * @returns Rate limit status
 */
export function checkRateLimit(
  workspaceId: string,
  ipHash: string,
  sessionId?: string
): RateLimitStatus {
  const workspace = getWorkspaceById(workspaceId);
  if (!workspace) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: null,
      daily_used: 0,
      daily_limit: 0,
      session_used: 0,
      session_limit: 0,
    };
  }

  // Get current window start (beginning of current hour)
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setMinutes(0, 0, 0);

  // Get daily usage (last 24 hours)
  const dailyUsage = getDailyUsage(workspaceId, ipHash);

  // Get session usage if session provided
  const sessionUsage = sessionId ? getSessionMessageCount(sessionId) : 0;

  // Calculate reset time (24 hours from first request today)
  const resetAt = getResetTime(workspaceId, ipHash);

  // Check limits
  const dailyLimitReached = dailyUsage >= workspace.daily_limit;
  const sessionLimitReached = sessionId
    ? sessionUsage >= workspace.session_limit
    : false;

  const allowed = !dailyLimitReached && !sessionLimitReached;
  const remaining = Math.max(
    0,
    Math.min(
      workspace.daily_limit - dailyUsage,
      sessionId ? workspace.session_limit - sessionUsage : Infinity
    )
  );

  return {
    allowed,
    remaining,
    resetAt,
    daily_used: dailyUsage,
    daily_limit: workspace.daily_limit,
    session_used: sessionUsage,
    session_limit: workspace.session_limit,
  };
}

/**
 * Increment rate limit counter
 */
export function incrementRateLimit(workspaceId: string, ipHash: string): void {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setMinutes(0, 0, 0);
  const windowStartStr = windowStart.toISOString();

  // Try to update existing record, or insert new one
  const result = execute(
    `UPDATE workspace_rate_limits
     SET request_count = request_count + 1
     WHERE workspace_id = ? AND ip_hash = ? AND window_start = ?`,
    [workspaceId, ipHash, windowStartStr]
  );

  if (result.changes === 0) {
    execute(
      `INSERT INTO workspace_rate_limits (workspace_id, ip_hash, window_start, request_count)
       VALUES (?, ?, ?, 1)`,
      [workspaceId, ipHash, windowStartStr]
    );
  }
}

// ============================================================================
// Usage Queries
// ============================================================================

/**
 * Get daily usage for an IP (last 24 hours)
 */
function getDailyUsage(workspaceId: string, ipHash: string): number {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const result = queryOne<{ total: number | null }>(
    `SELECT SUM(request_count) as total
     FROM workspace_rate_limits
     WHERE workspace_id = ? AND ip_hash = ? AND window_start >= ?`,
    [workspaceId, ipHash, cutoff]
  );

  return result?.total || 0;
}

/**
 * Get reset time (when the oldest window in the 24h period expires)
 */
function getResetTime(workspaceId: string, ipHash: string): Date | null {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const result = queryOne<{ oldest: string }>(
    `SELECT MIN(window_start) as oldest
     FROM workspace_rate_limits
     WHERE workspace_id = ? AND ip_hash = ? AND window_start >= ? AND request_count > 0`,
    [workspaceId, ipHash, cutoff]
  );

  if (!result?.oldest) return null;

  // Reset time is 24 hours after the oldest window
  const resetTime = new Date(result.oldest);
  resetTime.setHours(resetTime.getHours() + RATE_LIMIT_WINDOW_HOURS);
  return resetTime;
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up old rate limit records
 * Call this periodically (e.g., daily) to remove expired records
 */
export function cleanupOldRateLimits(): number {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const result = execute(
    'DELETE FROM workspace_rate_limits WHERE window_start < ?',
    [cutoff]
  );

  return result.changes;
}

/**
 * Probabilistic cleanup (call on each request with low probability)
 */
export function maybeCleanupRateLimits(probability: number = 0.01): void {
  if (Math.random() < probability) {
    cleanupOldRateLimits();
  }
}

// ============================================================================
// Admin Functions
// ============================================================================

/**
 * Reset rate limits for a specific IP on a workspace
 */
export function resetRateLimitsForIP(workspaceId: string, ipHash: string): number {
  const result = execute(
    'DELETE FROM workspace_rate_limits WHERE workspace_id = ? AND ip_hash = ?',
    [workspaceId, ipHash]
  );
  return result.changes;
}

/**
 * Reset all rate limits for a workspace
 */
export function resetWorkspaceRateLimits(workspaceId: string): number {
  const result = execute(
    'DELETE FROM workspace_rate_limits WHERE workspace_id = ?',
    [workspaceId]
  );
  return result.changes;
}

/**
 * Get rate limit statistics for a workspace
 */
export function getWorkspaceRateLimitStats(workspaceId: string): {
  total_requests: number;
  unique_ips: number;
  top_ips: Array<{ ip_hash: string; count: number }>;
} {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const totals = queryOne<{ total: number; unique_ips: number }>(
    `SELECT
       SUM(request_count) as total,
       COUNT(DISTINCT ip_hash) as unique_ips
     FROM workspace_rate_limits
     WHERE workspace_id = ? AND window_start >= ?`,
    [workspaceId, cutoff]
  );

  const topIPs = queryOne<Array<{ ip_hash: string; count: number }>>(
    `SELECT ip_hash, SUM(request_count) as count
     FROM workspace_rate_limits
     WHERE workspace_id = ? AND window_start >= ?
     GROUP BY ip_hash
     ORDER BY count DESC
     LIMIT 10`,
    [workspaceId, cutoff]
  ) as unknown as Array<{ ip_hash: string; count: number }> || [];

  return {
    total_requests: totals?.total || 0,
    unique_ips: totals?.unique_ips || 0,
    top_ips: topIPs,
  };
}

// ============================================================================
// Rate Limit Middleware Helper
// ============================================================================

/**
 * Check and increment rate limit in a single operation
 * Returns the rate limit status after incrementing
 */
export function checkAndIncrementRateLimit(
  workspaceId: string,
  ipHash: string,
  sessionId?: string
): RateLimitStatus {
  // Check first
  const status = checkRateLimit(workspaceId, ipHash, sessionId);

  // If allowed, increment the counter
  if (status.allowed) {
    incrementRateLimit(workspaceId, ipHash);
    status.remaining = Math.max(0, status.remaining - 1);
    status.daily_used += 1;
  }

  // Probabilistic cleanup
  maybeCleanupRateLimits(0.01);

  return status;
}

/**
 * Format rate limit headers for HTTP response
 */
export function getRateLimitHeaders(status: RateLimitStatus): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': status.daily_limit.toString(),
    'X-RateLimit-Remaining': status.remaining.toString(),
  };

  if (status.resetAt) {
    headers['X-RateLimit-Reset'] = Math.floor(status.resetAt.getTime() / 1000).toString();
  }

  if (!status.allowed) {
    headers['Retry-After'] = status.resetAt
      ? Math.max(0, Math.ceil((status.resetAt.getTime() - Date.now()) / 1000)).toString()
      : '3600';
  }

  return headers;
}
