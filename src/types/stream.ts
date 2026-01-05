/**
 * Streaming Types for Chat API
 *
 * Defines SSE event types for real-time streaming responses,
 * progressive disclosure UI state, and processing metadata.
 */

import type { Source, GeneratedDocumentInfo, GeneratedImageInfo, MessageVisualization } from './index';

// ============ Stream Phases ============

/**
 * Streaming phases for UI status display
 */
export type StreamPhase =
  | 'init'        // Connection established
  | 'rag'         // RAG retrieval in progress
  | 'tools'       // Executing tool calls
  | 'generating'  // Streaming LLM response
  | 'complete';   // All done

// ============ Skill & Tool Tracking ============

/**
 * Skill information for context display
 */
export interface SkillInfo {
  name: string;
  triggerReason?: 'always' | 'category' | 'keyword';
}

/**
 * Tool execution state for UI tracking
 */
export interface ToolExecutionState {
  name: string;
  displayName: string;
  status: 'pending' | 'running' | 'success' | 'error';
  startTime?: number;
  duration?: number;
  error?: string;
}

// ============ Stream Events ============

/**
 * Server-Sent Event types for chat streaming
 */
export type StreamEvent =
  // Status updates
  | { type: 'status'; phase: StreamPhase; content: string }

  // Context loaded (skills + available tools) - for progressive disclosure
  | { type: 'context_loaded'; skills: SkillInfo[]; toolsAvailable: string[] }

  // Tool execution tracking
  | { type: 'tool_start'; name: string; displayName: string }
  | { type: 'tool_end'; name: string; success: boolean; duration?: number; error?: string }

  // Artifacts
  | { type: 'artifact'; subtype: 'visualization'; data: MessageVisualization }
  | { type: 'artifact'; subtype: 'document'; data: GeneratedDocumentInfo }
  | { type: 'artifact'; subtype: 'image'; data: GeneratedImageInfo }

  // RAG sources
  | { type: 'sources'; data: Source[] }

  // Text content chunks
  | { type: 'chunk'; content: string }

  // Completion
  | { type: 'done'; messageId: string; threadId: string }

  // Error
  | { type: 'error'; code: StreamErrorCode; message: string; recoverable: boolean };

/**
 * Stream error codes
 */
export type StreamErrorCode =
  | 'AUTH_ERROR'
  | 'VALIDATION_ERROR'
  | 'RAG_ERROR'
  | 'TOOL_ERROR'
  | 'LLM_ERROR'
  | 'TIMEOUT_ERROR'
  | 'UNKNOWN_ERROR'
  // Workspace-specific error codes
  | 'FEATURE_DISABLED'
  | 'NOT_FOUND'
  | 'DISABLED'
  | 'DOMAIN_NOT_ALLOWED'
  | 'ACCESS_DENIED'
  | 'SESSION_EXPIRED'
  | 'SESSION_INVALID'
  | 'RATE_LIMITED';

// ============ Request/Response Types ============

/**
 * Request body for streaming endpoint
 */
export interface StreamChatRequest {
  message: string;
  threadId: string;
}

/**
 * Processing details for progressive disclosure UI
 * IMPORTANT: This is frontend-only state, NOT saved to database
 */
export interface ProcessingDetails {
  phase: StreamPhase;
  skills: SkillInfo[];
  toolsAvailable: string[];
  toolsExecuted: ToolExecutionState[];
  isExpanded: boolean; // UI state for collapse/expand
}

// ============ Streaming Callbacks ============

/**
 * Callbacks for streaming tool execution events
 * Used by generateResponseWithTools when streaming is enabled
 */
export interface StreamingCallbacks {
  onToolStart?: (name: string, displayName: string) => void;
  onToolEnd?: (name: string, success: boolean, duration: number, error?: string) => void;
  onArtifact?: (type: 'visualization' | 'document' | 'image', data: MessageVisualization | GeneratedDocumentInfo | GeneratedImageInfo) => void;
}
