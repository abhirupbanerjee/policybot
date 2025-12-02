import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { saveUpload, deleteUpload, getThread } from '@/lib/threads';
import type { UploadResponse, ApiError } from '@/types';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_UPLOADS = 3;

interface RouteParams {
  params: Promise<{ threadId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ApiError>(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const { threadId } = await params;

    // Verify thread exists and belongs to user
    const thread = await getThread(user.id, threadId);
    if (!thread) {
      return NextResponse.json<ApiError>(
        { error: 'Thread not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check upload limit
    if (thread.uploadCount >= MAX_UPLOADS) {
      return NextResponse.json<ApiError>(
        { error: `Maximum ${MAX_UPLOADS} files per thread`, code: 'UPLOAD_LIMIT' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json<ApiError>(
        { error: 'No file provided', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json<ApiError>(
        { error: 'Only PDF files allowed', code: 'INVALID_FILE_TYPE' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json<ApiError>(
        { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`, code: 'FILE_TOO_LARGE' },
        { status: 413 }
      );
    }

    // Save file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await saveUpload(user.id, threadId, file.name, buffer);

    return NextResponse.json<UploadResponse>({
      filename: result.filename,
      size: file.size,
      uploadCount: result.uploadCount,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json<ApiError>(
      {
        error: error instanceof Error ? error.message : 'Failed to upload file',
        code: 'SERVICE_ERROR',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json<ApiError>(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const { threadId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json<ApiError>(
        { error: 'Filename is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const uploadCount = await deleteUpload(user.id, threadId, filename);

    return NextResponse.json({
      success: true,
      filename,
      uploadCount,
    });
  } catch (error) {
    console.error('Delete upload error:', error);
    return NextResponse.json<ApiError>(
      {
        error: error instanceof Error ? error.message : 'Failed to delete file',
        code: 'SERVICE_ERROR',
      },
      { status: 500 }
    );
  }
}
