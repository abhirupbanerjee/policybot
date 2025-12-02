import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSystemPrompt, saveSystemPrompt } from '@/lib/storage';
import { invalidateQueryCache } from '@/lib/redis';
import type { ApiError } from '@/types';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ApiError>(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    if (!user.isAdmin) {
      return NextResponse.json<ApiError>(
        { error: 'Admin access required', code: 'ADMIN_REQUIRED' },
        { status: 403 }
      );
    }

    const config = await getSystemPrompt();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Get system prompt error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to get system prompt',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ApiError>(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    if (!user.isAdmin) {
      return NextResponse.json<ApiError>(
        { error: 'Admin access required', code: 'ADMIN_REQUIRED' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json<ApiError>(
        { error: 'Prompt is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (prompt.trim().length < 10) {
      return NextResponse.json<ApiError>(
        { error: 'Prompt must be at least 10 characters', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const config = await saveSystemPrompt(prompt.trim(), user.email);

    // Invalidate query cache since system prompt changed
    await invalidateQueryCache();

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('Update system prompt error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to update system prompt',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
