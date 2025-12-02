import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listGlobalDocuments, reindexDocument } from '@/lib/ingest';
import { clearAllCache } from '@/lib/redis';
import type { ApiError } from '@/types';

export async function POST() {
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

    // Clear Redis cache
    await clearAllCache();

    // Get all documents and reindex them
    const documents = await listGlobalDocuments();
    let reindexedCount = 0;
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        await reindexDocument(doc.id);
        reindexedCount++;
      } catch (error) {
        errors.push(`${doc.filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      documentsReindexed: reindexedCount,
      totalDocuments: documents.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to refresh',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
