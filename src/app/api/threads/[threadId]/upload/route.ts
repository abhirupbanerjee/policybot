import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { saveUpload, deleteUpload, getThread } from '@/lib/threads';
import { getUploadLimits } from '@/lib/db/config';
import type { UploadResponse, ApiError } from '@/types';

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

    // Get upload limits from config
    const uploadLimits = getUploadLimits();
    const maxFileSizeBytes = uploadLimits.maxFileSizeMB * 1024 * 1024;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json<ApiError>(
        { error: 'No file provided', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate file type against config allowedTypes
    if (!uploadLimits.allowedTypes.includes(file.type)) {
      const allowedExtensions = uploadLimits.allowedTypes
        .map(t => {
          if (t === 'application/pdf') return 'PDF';
          if (t === 'image/png') return 'PNG';
          if (t === 'image/jpeg') return 'JPG';
          return t;
        })
        .join(', ');
      return NextResponse.json<ApiError>(
        { error: `Invalid file type. Allowed: ${allowedExtensions}`, code: 'INVALID_FILE_TYPE' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > maxFileSizeBytes) {
      return NextResponse.json<ApiError>(
        { error: `File too large (max ${uploadLimits.maxFileSizeMB}MB)`, code: 'FILE_TOO_LARGE' },
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
