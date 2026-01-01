/**
 * Thread Sharing Database Operations
 *
 * CRUD operations for thread_shares and share_access_log tables.
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { execute, queryOne, queryAll, transaction } from './index';
import type { ThreadShare, ShareAccessLog } from '@/types';

// ============ Database Row Types ============

interface DbThreadShare {
  id: string;
  thread_id: string;
  share_token: string;
  created_by: number;
  allow_download: number;
  expires_at: string | null;
  view_count: number;
  created_at: string;
  last_viewed_at: string | null;
  revoked_at: string | null;
  // Joined fields
  creator_email?: string;
  creator_name?: string;
}

interface DbShareAccessLog {
  id: number;
  share_id: string;
  accessed_by: number;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  accessed_at: string;
  accessor_email?: string;
}

// ============ Mappers ============

function mapDbToThreadShare(row: DbThreadShare, baseUrl?: string): ThreadShare {
  const now = new Date();
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  const isExpired = expiresAt ? expiresAt < now : false;
  const isRevoked = !!row.revoked_at;

  return {
    id: row.id,
    threadId: row.thread_id,
    shareToken: row.share_token,
    createdBy: row.created_by,
    createdByEmail: row.creator_email,
    createdByName: row.creator_name,
    allowDownload: row.allow_download === 1,
    expiresAt,
    viewCount: row.view_count,
    createdAt: new Date(row.created_at),
    lastViewedAt: row.last_viewed_at ? new Date(row.last_viewed_at) : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    isActive: !isRevoked && !isExpired,
    isExpired,
    shareUrl: baseUrl ? `${baseUrl}/shared/${row.share_token}` : undefined,
  };
}

function mapDbToAccessLog(row: DbShareAccessLog): ShareAccessLog {
  return {
    id: row.id,
    shareId: row.share_id,
    accessedBy: row.accessed_by,
    accessedByEmail: row.accessor_email,
    action: row.action as 'view' | 'download',
    resourceType: row.resource_type || undefined,
    resourceId: row.resource_id || undefined,
    accessedAt: new Date(row.accessed_at),
  };
}

// ============ Token Generation ============

/**
 * Generate a cryptographically secure share token
 * Uses 32 bytes of random data (256 bits of entropy)
 */
export function generateShareToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// ============ Share CRUD Operations ============

/**
 * Create a new thread share
 */
export function createThreadShare(
  threadId: string,
  createdBy: number,
  options: {
    allowDownload?: boolean;
    expiresInDays?: number | null;
  } = {}
): ThreadShare {
  const id = uuidv4();
  const shareToken = generateShareToken();

  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  return transaction(() => {
    execute(
      `INSERT INTO thread_shares (id, thread_id, share_token, created_by, allow_download, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        threadId,
        shareToken,
        createdBy,
        options.allowDownload !== false ? 1 : 0,
        expiresAt,
      ]
    );

    return getShareById(id)!;
  });
}

/**
 * Get share by ID
 */
export function getShareById(shareId: string): ThreadShare | undefined {
  const row = queryOne<DbThreadShare>(
    `SELECT ts.*, u.email as creator_email, u.name as creator_name
     FROM thread_shares ts
     LEFT JOIN users u ON ts.created_by = u.id
     WHERE ts.id = ?`,
    [shareId]
  );
  return row ? mapDbToThreadShare(row) : undefined;
}

/**
 * Get share by token
 */
export function getShareByToken(token: string): ThreadShare | undefined {
  const row = queryOne<DbThreadShare>(
    `SELECT ts.*, u.email as creator_email, u.name as creator_name
     FROM thread_shares ts
     LEFT JOIN users u ON ts.created_by = u.id
     WHERE ts.share_token = ?`,
    [token]
  );
  return row ? mapDbToThreadShare(row) : undefined;
}

/**
 * Get all shares for a thread
 */
export function getThreadShares(threadId: string): ThreadShare[] {
  const rows = queryAll<DbThreadShare>(
    `SELECT ts.*, u.email as creator_email, u.name as creator_name
     FROM thread_shares ts
     LEFT JOIN users u ON ts.created_by = u.id
     WHERE ts.thread_id = ?
     ORDER BY ts.created_at DESC`,
    [threadId]
  );
  return rows.map((row) => mapDbToThreadShare(row));
}

/**
 * Get all shares created by a user
 */
export function getUserShares(userId: number): ThreadShare[] {
  const rows = queryAll<DbThreadShare>(
    `SELECT ts.*, u.email as creator_email, u.name as creator_name
     FROM thread_shares ts
     LEFT JOIN users u ON ts.created_by = u.id
     WHERE ts.created_by = ?
     ORDER BY ts.created_at DESC`,
    [userId]
  );
  return rows.map((row) => mapDbToThreadShare(row));
}

/**
 * Count active shares for a thread
 */
export function countActiveThreadShares(threadId: string): number {
  const result = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM thread_shares
     WHERE thread_id = ? AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    [threadId]
  );
  return result?.count || 0;
}

/**
 * Count shares created by user in the last hour (for rate limiting)
 */
export function countUserSharesInLastHour(userId: number): number {
  const result = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM thread_shares
     WHERE created_by = ? AND created_at > datetime('now', '-1 hour')`,
    [userId]
  );
  return result?.count || 0;
}

/**
 * Update share settings
 */
export function updateShare(
  shareId: string,
  updates: {
    allowDownload?: boolean;
    expiresInDays?: number | null;
  }
): ThreadShare | undefined {
  const existing = getShareById(shareId);
  if (!existing) return undefined;

  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.allowDownload !== undefined) {
    sets.push('allow_download = ?');
    values.push(updates.allowDownload ? 1 : 0);
  }

  if (updates.expiresInDays !== undefined) {
    sets.push('expires_at = ?');
    values.push(
      updates.expiresInDays
        ? new Date(Date.now() + updates.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null
    );
  }

  if (sets.length === 0) return existing;

  values.push(shareId);
  execute(`UPDATE thread_shares SET ${sets.join(', ')} WHERE id = ?`, values);

  return getShareById(shareId);
}

/**
 * Revoke a share (soft delete)
 */
export function revokeShare(shareId: string): boolean {
  const result = execute(
    `UPDATE thread_shares SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL`,
    [shareId]
  );
  return result.changes > 0;
}

/**
 * Delete a share permanently
 */
export function deleteShare(shareId: string): boolean {
  const result = execute('DELETE FROM thread_shares WHERE id = ?', [shareId]);
  return result.changes > 0;
}

/**
 * Record a view and increment view count
 */
export function recordShareView(shareId: string): void {
  execute(
    `UPDATE thread_shares
     SET view_count = view_count + 1, last_viewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [shareId]
  );
}

// ============ Share Validation ============

/**
 * Validate share access
 * Returns error message if invalid, null if valid
 */
export function validateShareAccess(share: ThreadShare): string | null {
  if (share.revokedAt) {
    return 'This share has been revoked';
  }

  if (share.isExpired) {
    return 'This share has expired';
  }

  return null; // Valid
}

// ============ Access Log Operations ============

/**
 * Log share access
 */
export function logShareAccess(
  shareId: string,
  accessedBy: number,
  action: 'view' | 'download',
  resourceType?: string,
  resourceId?: string
): void {
  execute(
    `INSERT INTO share_access_log (share_id, accessed_by, action, resource_type, resource_id)
     VALUES (?, ?, ?, ?, ?)`,
    [shareId, accessedBy, action, resourceType || null, resourceId || null]
  );
}

/**
 * Get access log for a share
 */
export function getShareAccessLog(shareId: string, limit: number = 100): ShareAccessLog[] {
  const rows = queryAll<DbShareAccessLog>(
    `SELECT sal.*, u.email as accessor_email
     FROM share_access_log sal
     LEFT JOIN users u ON sal.accessed_by = u.id
     WHERE sal.share_id = ?
     ORDER BY sal.accessed_at DESC
     LIMIT ?`,
    [shareId, limit]
  );
  return rows.map(mapDbToAccessLog);
}

// ============ Statistics ============

/**
 * Get sharing statistics
 */
export function getSharingStats(): {
  totalShares: number;
  activeShares: number;
  totalViews: number;
  sharesThisWeek: number;
} {
  const stats = queryOne<{
    total_shares: number;
    active_shares: number;
    total_views: number;
    shares_this_week: number;
  }>(`
    SELECT
      COUNT(*) as total_shares,
      SUM(CASE WHEN revoked_at IS NULL AND (expires_at IS NULL OR expires_at > datetime('now')) THEN 1 ELSE 0 END) as active_shares,
      SUM(view_count) as total_views,
      SUM(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 ELSE 0 END) as shares_this_week
    FROM thread_shares
  `);

  return {
    totalShares: stats?.total_shares || 0,
    activeShares: stats?.active_shares || 0,
    totalViews: stats?.total_views || 0,
    sharesThisWeek: stats?.shares_this_week || 0,
  };
}
