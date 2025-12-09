import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db/users';
import { queryOne } from '@/lib/db';
import { getArchivedMessages } from '@/lib/summarization';
import type { ApiError } from '@/types';

interface ThreadOwner {
  user_id: number;
}

/**
 * GET /api/threads/[threadId]/archived
 * Get archived messages for a thread (original messages before summarization)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ApiError>(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const { threadId } = await params;

    // Verify thread ownership
    const dbUser = getUserByEmail(user.email);
    if (!dbUser) {
      return NextResponse.json<ApiError>(
        { error: 'User not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const thread = queryOne<ThreadOwner>(
      'SELECT user_id FROM threads WHERE id = ?',
      [threadId]
    );

    if (!thread) {
      return NextResponse.json<ApiError>(
        { error: 'Thread not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (thread.user_id !== dbUser.id && !user.isAdmin) {
      return NextResponse.json<ApiError>(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get archived messages
    const archivedMessages = getArchivedMessages(threadId);

    return NextResponse.json({
      messages: archivedMessages,
      count: archivedMessages.length,
    });
  } catch (error) {
    console.error('Get archived messages error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to get archived messages',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
