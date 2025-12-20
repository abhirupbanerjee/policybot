/**
 * Admin - URL Ingestion API
 * POST /api/admin/documents/url - Ingest content from web URLs or YouTube
 * GET /api/admin/documents/url - Check URL ingestion availability
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { ingestUrls, ingestYouTubeUrl, getUrlIngestionStatus } from '@/lib/ingest';
import { isYouTubeUrl } from '@/lib/youtube';
import { isTavilyConfigured } from '@/lib/tools/tavily';
import type { ApiError } from '@/types';

const MAX_URLS = 5;
const MAX_NAME_LENGTH = 255;

interface UrlIngestionRequest {
  urls?: string[];
  youtubeUrl?: string;
  name?: string;
  categoryIds?: number[];
  isGlobal?: boolean;
}

interface UrlIngestionResponse {
  results: Array<{
    url: string;
    success: boolean;
    documentId?: string;
    filename?: string;
    sourceType: 'youtube' | 'web';
    error?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

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

    const body = await request.json() as UrlIngestionRequest;
    const { urls, youtubeUrl, name, categoryIds, isGlobal } = body;

    // Validate name if provided
    if (name && name.length > MAX_NAME_LENGTH) {
      return NextResponse.json<ApiError>(
        { error: `Name must be ${MAX_NAME_LENGTH} characters or less`, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Handle single YouTube URL with custom name
    if (youtubeUrl) {
      if (!isYouTubeUrl(youtubeUrl)) {
        return NextResponse.json<ApiError>(
          { error: 'Invalid YouTube URL', code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }

      try {
        const doc = await ingestYouTubeUrl(youtubeUrl, user.email, {
          categoryIds: categoryIds || [],
          isGlobal: isGlobal || false,
          customName: name,
        });

        return NextResponse.json<UrlIngestionResponse>({
          results: [{
            url: youtubeUrl,
            success: true,
            documentId: doc.id,
            filename: doc.filename,
            sourceType: 'youtube',
          }],
          summary: { total: 1, successful: 1, failed: 0 },
        }, { status: 202 });
      } catch (error) {
        return NextResponse.json<UrlIngestionResponse>({
          results: [{
            url: youtubeUrl,
            success: false,
            sourceType: 'youtube',
            error: error instanceof Error ? error.message : 'Failed to extract transcript',
          }],
          summary: { total: 1, successful: 0, failed: 1 },
        }, { status: 207 }); // Multi-status for partial success
      }
    }

    // Handle batch URLs (web and/or YouTube)
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json<ApiError>(
        { error: 'At least one URL is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (urls.length > MAX_URLS) {
      return NextResponse.json<ApiError>(
        { error: `Maximum ${MAX_URLS} URLs per batch`, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate URL formats
    const invalidUrls: string[] = [];
    for (const url of urls) {
      try {
        new URL(url);
      } catch {
        if (!isYouTubeUrl(url)) {
          invalidUrls.push(url);
        }
      }
    }

    if (invalidUrls.length > 0) {
      return NextResponse.json<ApiError>(
        { error: `Invalid URL format: ${invalidUrls.join(', ')}`, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Check if web URLs are present but Tavily not configured
    const hasWebUrls = urls.some(url => !isYouTubeUrl(url));
    if (hasWebUrls && !isTavilyConfigured()) {
      return NextResponse.json<ApiError>(
        { error: 'Web URL extraction requires Tavily API key. Configure in Settings > Web Search.', code: 'NOT_CONFIGURED' },
        { status: 400 }
      );
    }

    // Ingest all URLs
    const results = await ingestUrls(urls, user.email, {
      categoryIds: categoryIds || [],
      isGlobal: isGlobal || false,
    });

    const response: UrlIngestionResponse = {
      results: results.map(r => ({
        url: r.url,
        success: r.success,
        documentId: r.document?.id,
        filename: r.document?.filename,
        sourceType: r.sourceType,
        error: r.error,
      })),
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    };

    // Use 207 Multi-Status if there are mixed results
    const status = response.summary.failed === 0 ? 202 :
                   response.summary.successful === 0 ? 400 : 207;

    return NextResponse.json(response, { status });
  } catch (error) {
    console.error('URL ingestion error:', error);
    return NextResponse.json<ApiError>(
      {
        error: 'Failed to ingest URLs',
        code: 'SERVICE_ERROR',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Check URL ingestion availability
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

    const status = getUrlIngestionStatus();
    return NextResponse.json(status);
  } catch {
    return NextResponse.json<ApiError>(
      { error: 'Failed to check status', code: 'SERVICE_ERROR' },
      { status: 500 }
    );
  }
}
