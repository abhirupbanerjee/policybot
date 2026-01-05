/**
 * Workspace Thread Detail API
 *
 * CRUD operations for individual threads in standalone workspaces.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  validateWorkspaceRequest,
  extractOrigin,
} from '@/lib/workspace/validator';
import { getSession, isSessionValid } from '@/lib/db/workspace-sessions';
import {
  getThread,
  getThreadWithMessages,
  getThreadForSession,
  updateThread,
  deleteThread,
  archiveThread,
  autoTitleThread,
} from '@/lib/db/workspace-threads';
import type { UpdateWorkspaceThreadInput } from '@/types/workspace';

interface RouteContext {
  params: Promise<{ slug: string; threadId: string }>;
}

interface UpdateThreadRequest {
  sessionId: string;
  title?: string;
  is_archived?: boolean;
}

/**
 * GET /api/w/[slug]/threads/[threadId]
 *
 * Get thread details with messages.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { slug, threadId } = await context.params;
    const origin = extractOrigin(request.headers);
    const searchParams = request.nextUrl.searchParams;

    const sessionId = searchParams.get('sessionId');
    const includeMessages = searchParams.get('includeMessages') !== 'false';

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate workspace
    const validation = await validateWorkspaceRequest(slug, {
      origin: origin || undefined,
      checkEnabled: true,
    });

    if (!validation.valid || !validation.workspace) {
      return NextResponse.json(
        { error: validation.error, code: validation.errorCode },
        { status: 404 }
      );
    }

    const workspace = validation.workspace;

    // Threads only available for standalone mode
    if (workspace.type !== 'standalone') {
      return NextResponse.json(
        { error: 'Threads not available for embed workspaces', code: 'NOT_SUPPORTED' },
        { status: 400 }
      );
    }

    // Validate session
    if (!isSessionValid(sessionId)) {
      return NextResponse.json(
        { error: 'Session expired', code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    const session = getSession(sessionId);
    if (!session || session.workspace_id !== workspace.id) {
      return NextResponse.json(
        { error: 'Invalid session', code: 'SESSION_INVALID' },
        { status: 401 }
      );
    }

    // Get thread (must belong to session)
    const thread = getThreadForSession(threadId, sessionId);
    if (!thread) {
      return NextResponse.json(
        { error: 'Thread not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (includeMessages) {
      const threadWithMessages = getThreadWithMessages(threadId);
      return NextResponse.json({ thread: threadWithMessages });
    }

    return NextResponse.json({ thread });
  } catch (error) {
    console.error('Get thread error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/w/[slug]/threads/[threadId]
 *
 * Update thread (title, archive status).
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { slug, threadId } = await context.params;
    const origin = extractOrigin(request.headers);

    const body = await request.json() as UpdateThreadRequest;
    const { sessionId, title, is_archived } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate workspace
    const validation = await validateWorkspaceRequest(slug, {
      origin: origin || undefined,
      checkEnabled: true,
    });

    if (!validation.valid || !validation.workspace) {
      return NextResponse.json(
        { error: validation.error, code: validation.errorCode },
        { status: 404 }
      );
    }

    const workspace = validation.workspace;

    // Threads only available for standalone mode
    if (workspace.type !== 'standalone') {
      return NextResponse.json(
        { error: 'Threads not available for embed workspaces', code: 'NOT_SUPPORTED' },
        { status: 400 }
      );
    }

    // Validate session
    if (!isSessionValid(sessionId)) {
      return NextResponse.json(
        { error: 'Session expired', code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    const session = getSession(sessionId);
    if (!session || session.workspace_id !== workspace.id) {
      return NextResponse.json(
        { error: 'Invalid session', code: 'SESSION_INVALID' },
        { status: 401 }
      );
    }

    // Verify thread belongs to session
    const existingThread = getThreadForSession(threadId, sessionId);
    if (!existingThread) {
      return NextResponse.json(
        { error: 'Thread not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Build updates
    const updates: UpdateWorkspaceThreadInput = {};
    if (title !== undefined) {
      updates.title = title;
    }
    if (is_archived !== undefined) {
      updates.is_archived = is_archived;
    }

    const updatedThread = updateThread(threadId, updates);

    return NextResponse.json({ thread: updatedThread });
  } catch (error) {
    console.error('Update thread error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/w/[slug]/threads/[threadId]
 *
 * Delete a thread and all its messages.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { slug, threadId } = await context.params;
    const origin = extractOrigin(request.headers);
    const searchParams = request.nextUrl.searchParams;

    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate workspace
    const validation = await validateWorkspaceRequest(slug, {
      origin: origin || undefined,
      checkEnabled: true,
    });

    if (!validation.valid || !validation.workspace) {
      return NextResponse.json(
        { error: validation.error, code: validation.errorCode },
        { status: 404 }
      );
    }

    const workspace = validation.workspace;

    // Threads only available for standalone mode
    if (workspace.type !== 'standalone') {
      return NextResponse.json(
        { error: 'Threads not available for embed workspaces', code: 'NOT_SUPPORTED' },
        { status: 400 }
      );
    }

    // Validate session
    if (!isSessionValid(sessionId)) {
      return NextResponse.json(
        { error: 'Session expired', code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    const session = getSession(sessionId);
    if (!session || session.workspace_id !== workspace.id) {
      return NextResponse.json(
        { error: 'Invalid session', code: 'SESSION_INVALID' },
        { status: 401 }
      );
    }

    // Verify thread belongs to session
    const existingThread = getThreadForSession(threadId, sessionId);
    if (!existingThread) {
      return NextResponse.json(
        { error: 'Thread not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Delete thread (cascade deletes messages)
    const deleted = deleteThread(threadId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete thread', code: 'DELETE_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete thread error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/w/[slug]/threads/[threadId]
 *
 * Special actions on thread:
 * - action: 'auto-title' - Generate title from first message
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { slug, threadId } = await context.params;
    const origin = extractOrigin(request.headers);

    const body = await request.json();
    const { sessionId, action } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate workspace
    const validation = await validateWorkspaceRequest(slug, {
      origin: origin || undefined,
      checkEnabled: true,
    });

    if (!validation.valid || !validation.workspace) {
      return NextResponse.json(
        { error: validation.error, code: validation.errorCode },
        { status: 404 }
      );
    }

    const workspace = validation.workspace;

    // Threads only available for standalone mode
    if (workspace.type !== 'standalone') {
      return NextResponse.json(
        { error: 'Threads not available for embed workspaces', code: 'NOT_SUPPORTED' },
        { status: 400 }
      );
    }

    // Validate session
    if (!isSessionValid(sessionId)) {
      return NextResponse.json(
        { error: 'Session expired', code: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    const session = getSession(sessionId);
    if (!session || session.workspace_id !== workspace.id) {
      return NextResponse.json(
        { error: 'Invalid session', code: 'SESSION_INVALID' },
        { status: 401 }
      );
    }

    // Verify thread belongs to session
    const existingThread = getThreadForSession(threadId, sessionId);
    if (!existingThread) {
      return NextResponse.json(
        { error: 'Thread not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Handle action
    switch (action) {
      case 'auto-title': {
        const title = autoTitleThread(threadId);
        const updatedThread = getThread(threadId);
        return NextResponse.json({ thread: updatedThread, generatedTitle: title });
      }

      case 'archive': {
        const archivedThread = archiveThread(threadId, true);
        return NextResponse.json({ thread: archivedThread });
      }

      case 'unarchive': {
        const unarchivedThread = archiveThread(threadId, false);
        return NextResponse.json({ thread: unarchivedThread });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action', code: 'INVALID_ACTION' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Thread action error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
