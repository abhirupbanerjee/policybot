/**
 * Super User Backup API
 *
 * POST /api/superuser/backup
 * Exports threads and messages from categories assigned to the superuser.
 * Returns JSON file with thread data scoped to their assigned categories.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserRole, getUserId } from '@/lib/users';
import { getSuperUserWithAssignments } from '@/lib/db/users';
import { queryAll } from '@/lib/db';
import type { ApiError } from '@/types';

interface ThreadExport {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  categories: {
    id: number;
    name: string;
    slug: string;
  }[];
  messages: {
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }[];
}

interface BackupData {
  exportedAt: string;
  exportedBy: string;
  version: string;
  categories: {
    id: number;
    name: string;
    slug: string;
  }[];
  threads: ThreadExport[];
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ApiError>(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const role = await getUserRole(user.email);
    if (role !== 'superuser') {
      return NextResponse.json<ApiError>(
        { error: 'Super user access required', code: 'ADMIN_REQUIRED' },
        { status: 403 }
      );
    }

    const userId = await getUserId(user.email);
    if (!userId) {
      return NextResponse.json<ApiError>(
        { error: 'User not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get super user's assigned categories
    const superUserData = getSuperUserWithAssignments(userId);
    if (!superUserData || superUserData.assignedCategories.length === 0) {
      // Return empty backup if no categories assigned
      const emptyBackup: BackupData = {
        exportedAt: new Date().toISOString(),
        exportedBy: user.email,
        version: '1.0',
        categories: [],
        threads: [],
      };
      return new Response(JSON.stringify(emptyBackup, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="threads-backup-${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    }

    const categoryIds = superUserData.assignedCategories.map(c => c.categoryId);
    const placeholders = categoryIds.map(() => '?').join(', ');

    // Get threads that have at least one category in the superuser's assigned categories
    const threads = queryAll<{
      id: string;
      title: string;
      created_at: string;
      updated_at: string;
    }>(`
      SELECT DISTINCT t.id, t.title, t.created_at, t.updated_at
      FROM threads t
      JOIN thread_categories tc ON t.id = tc.thread_id
      WHERE tc.category_id IN (${placeholders})
      ORDER BY t.updated_at DESC
    `, categoryIds);

    // Build thread exports with messages
    const threadExports: ThreadExport[] = [];

    for (const thread of threads) {
      // Get categories for this thread (only the ones superuser has access to)
      const threadCategories = queryAll<{
        id: number;
        name: string;
        slug: string;
      }>(`
        SELECT c.id, c.name, c.slug
        FROM categories c
        JOIN thread_categories tc ON c.id = tc.category_id
        WHERE tc.thread_id = ? AND c.id IN (${placeholders})
      `, [thread.id, ...categoryIds]);

      // Get messages for this thread
      const messages = queryAll<{
        id: string;
        role: string;
        content: string;
        created_at: string;
      }>(`
        SELECT id, role, content, created_at
        FROM messages
        WHERE thread_id = ?
        ORDER BY created_at ASC
      `, [thread.id]);

      threadExports.push({
        id: thread.id,
        title: thread.title,
        createdAt: thread.created_at,
        updatedAt: thread.updated_at,
        categories: threadCategories,
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.created_at,
        })),
      });
    }

    const backup: BackupData = {
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
      version: '1.0',
      categories: superUserData.assignedCategories.map(c => ({
        id: c.categoryId,
        name: c.categoryName,
        slug: c.categorySlug,
      })),
      threads: threadExports,
    };

    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="threads-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Superuser backup error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to create backup',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
