/**
 * Streaming Utilities
 *
 * SSE encoder, phase messages, and tool display name mappings
 * for the streaming chat API.
 */

import type { StreamEvent, StreamPhase } from '@/types/stream';

/**
 * Create SSE encoder for streaming responses
 */
export function createSSEEncoder() {
  const encoder = new TextEncoder();

  return {
    /**
     * Encode a stream event as SSE data
     */
    encode(event: StreamEvent): Uint8Array {
      return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
    },

    /**
     * Encode a keep-alive comment
     */
    keepAlive(): Uint8Array {
      return encoder.encode(`: keep-alive\n\n`);
    },
  };
}

/**
 * SSE response headers
 */
export function getSSEHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  };
}

/**
 * Tool display name mapping
 * Maps internal tool names to user-friendly display names
 */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  web_search: 'Web Search',
  doc_gen: 'Document Generator',
  chart_gen: 'Chart Generator',
  data_source: 'Data Query',
  task_planner: 'Task Planner',
  function_api: 'External API',
  youtube: 'YouTube',
};

/**
 * Get user-friendly display name for a tool
 */
export function getToolDisplayName(toolName: string): string {
  return TOOL_DISPLAY_NAMES[toolName] || toolName;
}

/**
 * Phase status messages for UI display
 */
const PHASE_MESSAGES: Record<StreamPhase, string> = {
  init: 'Starting...',
  rag: 'Searching knowledge base...',
  tools: 'Processing tools...',
  generating: 'Generating response...',
  agent_planning: 'Creating autonomous task plan...',
  agent_executing: 'Executing autonomous tasks...',
  agent_summarizing: 'Generating summary...',
  complete: 'Complete',
};

/**
 * Get status message for a stream phase
 */
export function getPhaseMessage(phase: StreamPhase): string {
  return PHASE_MESSAGES[phase] || 'Processing...';
}

/**
 * Constants for streaming configuration
 */
export const STREAMING_CONFIG = {
  /** Interval for keep-alive pings in milliseconds */
  KEEPALIVE_INTERVAL_MS: 15000,

  /** Maximum stream duration in milliseconds (3 minutes) */
  MAX_STREAM_DURATION_MS: 180000,

  /** Tool execution timeout in milliseconds */
  TOOL_TIMEOUT_MS: 60000,
} as const;
