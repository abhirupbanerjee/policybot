/**
 * Admin Super Users API
 *
 * GET /api/admin/super-users - List all super users with their assigned categories
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getSuperUsers, getSuperUserWithAssignments } from '@/lib/db/users';

export async function GET() {
  try {
    await requireAdmin();

    const superUsers = getSuperUsers();

    // Get assignments for each super user
    const superUsersWithAssignments = superUsers.map(user => {
      const withAssignments = getSuperUserWithAssignments(user.id);
      return withAssignments || { ...user, assignedCategories: [] };
    });

    return NextResponse.json({ superUsers: superUsersWithAssignments });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.error('Error fetching super users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch super users' },
      { status: 500 }
    );
  }
}
