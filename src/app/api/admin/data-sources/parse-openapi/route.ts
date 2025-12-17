/**
 * Admin OpenAPI Parser API
 *
 * POST /api/admin/data-sources/parse-openapi - Parse an OpenAPI YAML spec
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  validateOpenAPISpec,
  parseOpenAPISpec,
  parsedOpenAPIToConfig,
} from '@/lib/data-sources/openapi-parser';

/**
 * POST /api/admin/data-sources/parse-openapi
 * Parse an OpenAPI YAML specification
 *
 * Body: { yaml: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.yaml) {
      return NextResponse.json(
        { error: 'YAML content is required' },
        { status: 400 }
      );
    }

    // Validate the spec first
    const validation = validateOpenAPISpec(body.yaml);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        errors: validation.errors,
        warnings: validation.warnings,
      }, { status: 400 });
    }

    // Parse the spec
    const parsed = parseOpenAPISpec(body.yaml);

    // Convert to DataAPIConfig format
    const config = parsedOpenAPIToConfig(parsed);

    return NextResponse.json({
      success: true,
      warnings: validation.warnings,
      parsed: {
        name: parsed.name,
        description: parsed.description,
        endpoint: parsed.endpoint,
        method: parsed.method,
        path: parsed.path,
        authentication: parsed.authentication,
        parameters: parsed.parameters,
        responseStructure: parsed.responseStructure,
        sampleResponse: parsed.sampleResponse,
      },
      config,
    });
  } catch (error) {
    console.error('Failed to parse OpenAPI spec:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse OpenAPI specification',
      },
      { status: 400 }
    );
  }
}
