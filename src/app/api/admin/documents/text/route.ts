import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listGlobalDocuments, ingestTextContent } from '@/lib/ingest';
import type { AdminUploadResponse, ApiError } from '@/types';

const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_CONTENT_LENGTH = 10; // Minimum 10 characters
const MAX_NAME_LENGTH = 255;

export async function POST(request: NextRequest) {
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
    const { name, content, categoryIds, isGlobal } = body as {
      name?: string;
      content?: string;
      categoryIds?: number[];
      isGlobal?: boolean;
    };

    // Validate name
    if (!name || typeof name !== 'string') {
      return NextResponse.json<ApiError>(
        { error: 'Document name is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json<ApiError>(
        { error: `Document name must be ${MAX_NAME_LENGTH} characters or less`, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate content
    if (!content || typeof content !== 'string') {
      return NextResponse.json<ApiError>(
        { error: 'Content is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (content.length < MIN_CONTENT_LENGTH) {
      return NextResponse.json<ApiError>(
        { error: `Content must be at least ${MIN_CONTENT_LENGTH} characters`, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const contentSize = Buffer.byteLength(content, 'utf-8');
    if (contentSize > MAX_CONTENT_SIZE) {
      return NextResponse.json<ApiError>(
        { error: `Content too large (max ${MAX_CONTENT_SIZE / 1024 / 1024}MB)`, code: 'FILE_TOO_LARGE' },
        { status: 413 }
      );
    }

    // Check for duplicate filename (adding .txt extension if needed)
    const filename = name.endsWith('.txt') ? name : `${name}.txt`;
    const existingDocs = await listGlobalDocuments();
    if (existingDocs.some(d => d.filename.toLowerCase() === filename.toLowerCase())) {
      return NextResponse.json<ApiError>(
        { error: 'Document with this name already exists', code: 'VALIDATION_ERROR' },
        { status: 409 }
      );
    }

    // Ingest text content
    const doc = await ingestTextContent(content, name, user.email, {
      categoryIds: categoryIds || [],
      isGlobal: isGlobal || false,
    });

    return NextResponse.json<AdminUploadResponse>(
      {
        id: doc.id,
        filename: doc.filename,
        size: doc.size,
        status: 'processing',
        message: 'Document is being processed',
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('Text upload error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to upload text content',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
