/**
 * API Utilities
 *
 * Helper functions for consistent API response handling.
 */

import { NextResponse } from 'next/server';
import type { ApiError, ErrorCode } from '@/types';

/**
 * Create a standardized error response
 *
 * @param error - Error message to return
 * @param code - Error code for client handling
 * @param status - HTTP status code (default: 400)
 * @param details - Optional additional details
 * @returns NextResponse with standardized error format
 *
 * @example
 * ```typescript
 * // In an API route:
 * if (!session) {
 *   return apiError('Authentication required', 'AUTH_REQUIRED', 401);
 * }
 *
 * if (!user.isAdmin) {
 *   return apiError('Admin access required', 'ADMIN_REQUIRED', 403);
 * }
 * ```
 */
export function apiError(
  error: string,
  code: ErrorCode,
  status: number = 400,
  details?: string
): NextResponse<ApiError> {
  return NextResponse.json<ApiError>(
    { error, code, details },
    { status }
  );
}

/**
 * Common error responses for reuse
 */
export const errors = {
  /** 401 - User not authenticated */
  unauthorized: () => apiError('Authentication required', 'AUTH_REQUIRED', 401),

  /** 403 - User lacks admin privileges */
  adminRequired: () => apiError('Admin access required', 'ADMIN_REQUIRED', 403),

  /** 404 - Resource not found */
  notFound: (resource: string = 'Resource') =>
    apiError(`${resource} not found`, 'NOT_FOUND', 404),

  /** 400 - Validation failed */
  validation: (message: string, details?: string) =>
    apiError(message, 'VALIDATION_ERROR', 400, details),

  /** 400 - File too large */
  fileTooLarge: (maxSize: string) =>
    apiError(`File exceeds maximum size of ${maxSize}`, 'FILE_TOO_LARGE', 400),

  /** 400 - Upload limit reached */
  uploadLimit: (limit: number) =>
    apiError(`Maximum upload limit of ${limit} files reached`, 'UPLOAD_LIMIT', 400),

  /** 400 - Invalid file type */
  invalidFileType: (allowed: string[]) =>
    apiError(
      `Invalid file type. Allowed types: ${allowed.join(', ')}`,
      'INVALID_FILE_TYPE',
      400
    ),

  /** 500 - Internal service error */
  serviceError: (message: string = 'An internal error occurred', details?: string) =>
    apiError(message, 'SERVICE_ERROR', 500, details),

  /** 429 - Rate limited */
  rateLimited: (retryAfter?: number) =>
    apiError(
      retryAfter
        ? `Rate limited. Please retry after ${retryAfter} seconds`
        : 'Too many requests. Please try again later',
      'RATE_LIMITED',
      429
    ),

  /** 400 - Feature not configured */
  notConfigured: (feature: string) =>
    apiError(`${feature} is not configured`, 'NOT_CONFIGURED', 400),
} as const;

/**
 * Create a standardized success response
 *
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with data
 */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/**
 * Type guard to check if an error is an API error
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as ApiError).error === 'string'
  );
}
