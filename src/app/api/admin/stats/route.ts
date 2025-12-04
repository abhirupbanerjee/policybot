/**
 * Admin Stats API
 *
 * GET /api/admin/stats
 * Returns system statistics for the admin dashboard:
 * - Database stats (users, threads, documents)
 * - ChromaDB stats (collections, vector counts)
 * - File storage stats (disk usage)
 * - Recent activity
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSystemStats, getRecentActivity } from '@/lib/monitoring';
import type { ApiError } from '@/types';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' } as ApiError,
        { status: 401 }
      );
    }

    if (!user.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' } as ApiError,
        { status: 403 }
      );
    }

    // Get system stats and recent activity in parallel
    const [systemStats, recentActivity] = await Promise.all([
      getSystemStats(),
      Promise.resolve(getRecentActivity(10)),
    ]);

    return NextResponse.json({
      ...systemStats,
      recentActivity,
    });
  } catch (error) {
    console.error('Failed to fetch system stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system stats' } as ApiError,
      { status: 500 }
    );
  }
}
