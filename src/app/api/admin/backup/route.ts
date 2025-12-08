import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createBackup, type BackupOptions } from '@/lib/backup';
import { checkEnvFileExists } from '@/lib/db/backup';
import type { ApiError } from '@/types';

/**
 * GET /api/admin/backup
 * Get backup info including .env file availability
 */
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

    return NextResponse.json({
      envFileAvailable: checkEnvFileExists(),
    });
  } catch (error) {
    console.error('Backup info error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to get backup info',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/backup
 * Create and download a backup ZIP file
 */
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

    // Parse backup options from request body
    const body = await request.json();
    const options: BackupOptions = {
      includeDocuments: body.includeDocuments !== false,
      includeDocumentFiles: body.includeDocumentFiles !== false,
      includeCategories: body.includeCategories !== false,
      includeSettings: body.includeSettings !== false,
      includeUsers: body.includeUsers !== false,
      includeThreads: body.includeThreads === true, // Default false (can be large)
      includeEnvFile: body.includeEnvFile === true, // Default false (sensitive)
    };

    // Create backup
    const { stream, filename } = await createBackup(options, user.email);

    // Convert Node.js stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => {
          controller.enqueue(chunk);
        });
        stream.on('end', () => {
          controller.close();
        });
        stream.on('error', (err: Error) => {
          controller.error(err);
        });
      },
    });

    // Return streaming response
    return new Response(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Backup error:', error);
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
