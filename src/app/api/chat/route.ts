import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUser } from '@/lib/auth';
import { ragQuery } from '@/lib/rag';
import { getThread, addMessage, getMessages, getUploadPaths, getThreadCategorySlugsForQuery } from '@/lib/threads';
import type { Message, ChatRequest, ChatResponse, ApiError } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ApiError>(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const body = await request.json() as ChatRequest;
    const { message, threadId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json<ApiError>(
        { error: 'Message is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (!threadId || typeof threadId !== 'string') {
      return NextResponse.json<ApiError>(
        { error: 'Thread ID is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Verify thread ownership
    const thread = await getThread(user.id, threadId);
    if (!thread) {
      return NextResponse.json<ApiError>(
        { error: 'Thread not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Create user message
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    // Save user message
    await addMessage(user.id, threadId, userMessage);

    // Get conversation history
    const conversationHistory = await getMessages(user.id, threadId, 5);

    // Get user uploaded documents
    const uploadPaths = await getUploadPaths(user.id, threadId);

    // Get thread categories for category-based search
    const categorySlugs = await getThreadCategorySlugsForQuery(threadId);
    console.log('[Chat API] Thread categories:', { threadId, categorySlugs });

    // Run RAG query with category context
    const { answer, sources } = await ragQuery(
      message,
      conversationHistory.slice(0, -1), // Exclude the message we just added
      uploadPaths,
      categorySlugs.length > 0 ? categorySlugs : undefined
    );

    // Create assistant message
    const assistantMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: answer,
      sources,
      timestamp: new Date(),
    };

    // Save assistant message
    await addMessage(user.id, threadId, assistantMessage);

    return NextResponse.json<ChatResponse>({
      message: assistantMessage,
      threadId,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to process message',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
