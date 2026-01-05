/**
 * Workspace User Management
 *
 * Manages user access for standalone workspaces with explicit access mode.
 * Allows admin/superuser to add/remove users from workspaces.
 */

import { getDatabase, queryAll, queryOne, execute, transaction } from './index';
import type { WorkspaceUser } from '@/types/workspace';

// ============================================================================
// User Management
// ============================================================================

/**
 * Add a user to a workspace (for explicit access mode)
 */
export function addUserToWorkspace(
  workspaceId: string,
  userId: number,
  addedBy: string
): void {
  execute(
    `INSERT OR IGNORE INTO workspace_users (workspace_id, user_id, added_by)
     VALUES (?, ?, ?)`,
    [workspaceId, userId, addedBy]
  );
}

/**
 * Remove a user from a workspace
 */
export function removeUserFromWorkspace(workspaceId: string, userId: number): boolean {
  const result = execute(
    'DELETE FROM workspace_users WHERE workspace_id = ? AND user_id = ?',
    [workspaceId, userId]
  );
  return result.changes > 0;
}

/**
 * Get all users with access to a workspace
 */
export function getWorkspaceUsers(workspaceId: string): WorkspaceUser[] {
  return queryAll<WorkspaceUser>(
    `SELECT
       wu.workspace_id,
       wu.user_id,
       u.email as user_email,
       u.name as user_name,
       wu.added_by,
       wu.added_at
     FROM workspace_users wu
     INNER JOIN users u ON wu.user_id = u.id
     WHERE wu.workspace_id = ?
     ORDER BY wu.added_at DESC`,
    [workspaceId]
  );
}

/**
 * Check if a user is in the workspace access list
 */
export function isUserInWorkspaceAccessList(
  userId: number,
  workspaceId: string
): boolean {
  const result = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM workspace_users WHERE workspace_id = ? AND user_id = ?',
    [workspaceId, userId]
  );
  return (result?.count || 0) > 0;
}

/**
 * Bulk add users to a workspace
 */
export function bulkAddUsersToWorkspace(
  workspaceId: string,
  userIds: number[],
  addedBy: string
): { added: number; skipped: number } {
  const db = getDatabase();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO workspace_users (workspace_id, user_id, added_by)
     VALUES (?, ?, ?)`
  );

  let added = 0;
  let skipped = 0;

  transaction(() => {
    for (const userId of userIds) {
      const result = stmt.run(workspaceId, userId, addedBy);
      if (result.changes > 0) {
        added++;
      } else {
        skipped++;
      }
    }
  });

  return { added, skipped };
}

/**
 * Bulk remove users from a workspace
 */
export function bulkRemoveUsersFromWorkspace(
  workspaceId: string,
  userIds: number[]
): number {
  if (userIds.length === 0) return 0;

  const placeholders = userIds.map(() => '?').join(',');
  const result = execute(
    `DELETE FROM workspace_users WHERE workspace_id = ? AND user_id IN (${placeholders})`,
    [workspaceId, ...userIds]
  );
  return result.changes;
}

/**
 * Get count of users in a workspace
 */
export function getWorkspaceUserCount(workspaceId: string): number {
  const result = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM workspace_users WHERE workspace_id = ?',
    [workspaceId]
  );
  return result?.count || 0;
}

/**
 * Get workspaces a user has been explicitly added to
 */
export function getUserWorkspaces(userId: number): string[] {
  return queryAll<{ workspace_id: string }>(
    'SELECT workspace_id FROM workspace_users WHERE user_id = ?',
    [userId]
  ).map((r) => r.workspace_id);
}

/**
 * Remove all users from a workspace
 */
export function clearWorkspaceUsers(workspaceId: string): number {
  const result = execute(
    'DELETE FROM workspace_users WHERE workspace_id = ?',
    [workspaceId]
  );
  return result.changes;
}

/**
 * Set workspace users (replace all existing)
 */
export function setWorkspaceUsers(
  workspaceId: string,
  userIds: number[],
  addedBy: string
): void {
  transaction(() => {
    clearWorkspaceUsers(workspaceId);
    if (userIds.length > 0) {
      bulkAddUsersToWorkspace(workspaceId, userIds, addedBy);
    }
  });
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Get users who can be added to a workspace (have required category access)
 * Used by superusers who can only add users from their assigned categories
 */
export function getEligibleUsersForWorkspace(
  workspaceId: string,
  limitToCategoryIds?: number[]
): Array<{ id: number; email: string; name: string | null }> {
  // Get workspace categories
  const workspaceCategories = queryAll<{ category_id: number }>(
    'SELECT category_id FROM workspace_categories WHERE workspace_id = ?',
    [workspaceId]
  ).map((r) => r.category_id);

  if (workspaceCategories.length === 0) {
    // No category restrictions - return all users not already added
    return queryAll<{ id: number; email: string; name: string | null }>(
      `SELECT u.id, u.email, u.name FROM users u
       WHERE u.id NOT IN (
         SELECT user_id FROM workspace_users WHERE workspace_id = ?
       )
       ORDER BY u.email`,
      [workspaceId]
    );
  }

  // If limitToCategoryIds provided (for superuser), intersect with workspace categories
  const effectiveCategories = limitToCategoryIds
    ? workspaceCategories.filter((id) => limitToCategoryIds.includes(id))
    : workspaceCategories;

  if (effectiveCategories.length === 0) {
    return []; // Superuser has no overlap with workspace categories
  }

  // Find users who have ALL workspace categories
  const placeholders = effectiveCategories.map(() => '?').join(',');
  return queryAll<{ id: number; email: string; name: string | null }>(
    `SELECT u.id, u.email, u.name FROM users u
     WHERE u.id NOT IN (
       SELECT user_id FROM workspace_users WHERE workspace_id = ?
     )
     AND (
       SELECT COUNT(DISTINCT us.category_id)
       FROM user_subscriptions us
       WHERE us.user_id = u.id AND us.is_active = 1
       AND us.category_id IN (${placeholders})
     ) = ?
     ORDER BY u.email`,
    [workspaceId, ...effectiveCategories, effectiveCategories.length]
  );
}

/**
 * Check if a superuser can manage users for a workspace
 * Superuser must have access to ALL workspace categories
 */
export function canSuperuserManageWorkspaceUsers(
  superuserId: number,
  workspaceId: string
): boolean {
  // Get workspace categories
  const workspaceCategories = queryAll<{ category_id: number }>(
    'SELECT category_id FROM workspace_categories WHERE workspace_id = ?',
    [workspaceId]
  ).map((r) => r.category_id);

  if (workspaceCategories.length === 0) return true;

  // Get superuser's assigned categories
  const superuserCategories = queryAll<{ category_id: number }>(
    'SELECT category_id FROM super_user_categories WHERE user_id = ?',
    [superuserId]
  ).map((r) => r.category_id);

  // Superuser must have ALL workspace categories
  return workspaceCategories.every((catId) => superuserCategories.includes(catId));
}
