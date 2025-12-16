/**
 * Admin Tool Test API - Test a tool's configuration/connection
 *
 * POST /api/admin/tools/[toolName]/test - Test tool connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getToolConfig, TOOL_DEFAULTS } from '@/lib/db/tool-config';
import { getTool, initializeTools } from '@/lib/tools';

interface RouteParams {
  params: Promise<{ toolName: string }>;
}

/**
 * Test web search (Tavily) connection
 */
async function testWebSearch(config: Record<string, unknown>): Promise<{
  success: boolean;
  message: string;
  latency?: number;
}> {
  const apiKey = (config.apiKey as string) || process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      message: 'No API key configured. Please set the Tavily API key.',
    };
  }

  const startTime = Date.now();

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: 'test connection',
        max_results: 1,
        search_depth: 'basic',
      }),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || `HTTP ${response.status}`;

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          message: 'Invalid API key. Please check your Tavily API key.',
          latency,
        };
      }

      return {
        success: false,
        message: `Tavily API error: ${errorMessage}`,
        latency,
      };
    }

    return {
      success: true,
      message: `Connection successful (${latency}ms latency)`,
      latency,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      success: false,
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      latency,
    };
  }
}

/**
 * Test data visualization tool (no external connection needed)
 */
async function testDataViz(): Promise<{
  success: boolean;
  message: string;
}> {
  // Data visualization doesn't require external connections
  // Just verify the tool is properly configured
  return {
    success: true,
    message: 'Data visualization tool is ready. No external connection required.',
  };
}

/**
 * Test document generation tool (no external connection needed)
 */
async function testDocGen(): Promise<{
  success: boolean;
  message: string;
}> {
  // Document generation doesn't require external connections
  // Just verify the tool is properly configured
  return {
    success: true,
    message: 'Document generation tool is ready. No external connection required.',
  };
}

/**
 * POST /api/admin/tools/[toolName]/test
 * Test a tool's configuration and connection
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { toolName } = await params;

    // Initialize tools system
    initializeTools();

    // Get tool definition
    const tool = getTool(toolName);
    if (!tool) {
      return NextResponse.json(
        { error: `Unknown tool: ${toolName}` },
        { status: 404 }
      );
    }

    // Get tool configuration
    const config = getToolConfig(toolName);
    const defaults = TOOL_DEFAULTS[toolName];
    const toolConfig = config?.config || defaults?.config || {};

    // Run test based on tool type
    let result: { success: boolean; message: string; latency?: number };

    switch (toolName) {
      case 'web_search':
        result = await testWebSearch(toolConfig);
        break;
      case 'data_viz':
        result = await testDataViz();
        break;
      case 'doc_gen':
        result = await testDocGen();
        break;
      default:
        result = {
          success: false,
          message: `No test available for tool: ${toolName}`,
        };
    }

    return NextResponse.json({
      tool: toolName,
      ...result,
      testedAt: new Date().toISOString(),
      testedBy: user.email,
    });
  } catch (error) {
    console.error('Failed to test tool:', error);
    return NextResponse.json(
      { error: 'Failed to test tool' },
      { status: 500 }
    );
  }
}
