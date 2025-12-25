/**
 * Streaming Chat Hook
 *
 * React hook for SSE-based streaming chat with:
 * - Chunk batching via requestAnimationFrame for performance
 * - ProcessingDetails state management
 * - Abort controller handling
 * - Progressive disclosure UI state
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  StreamEvent,
  StreamPhase,
  ToolExecutionState,
  ProcessingDetails,
  Source,
  MessageVisualization,
  GeneratedDocumentInfo,
} from '@/types';

// ============ Types ============

export interface StreamingState {
  /** Whether streaming is in progress */
  isStreaming: boolean;
  /** Current phase of streaming */
  phase: StreamPhase | null;
  /** Accumulated content from chunks */
  currentContent: string;
  /** Processing details for progressive disclosure */
  processingDetails: ProcessingDetails;
  /** RAG sources received */
  sources: Source[];
  /** Visualizations from tools */
  visualizations: MessageVisualization[];
  /** Generated documents from tools */
  documents: GeneratedDocumentInfo[];
  /** Error message if any */
  error: string | null;
  /** Whether error is recoverable */
  errorRecoverable: boolean;
}

export interface UseStreamingChatOptions {
  /** Callback when streaming completes successfully */
  onComplete?: (messageId: string, content: string, sources: Source[], visualizations: MessageVisualization[], documents: GeneratedDocumentInfo[]) => void;
  /** Callback on error */
  onError?: (code: string, message: string, recoverable: boolean) => void;
  /** Callback when phase changes */
  onPhaseChange?: (phase: StreamPhase) => void;
}

export interface UseStreamingChatReturn {
  /** Current streaming state */
  state: StreamingState;
  /** Send a message and start streaming */
  sendMessage: (message: string, threadId: string) => Promise<void>;
  /** Abort current streaming */
  abort: () => void;
  /** Toggle processing details expansion */
  toggleProcessingDetails: () => void;
  /** Reset state for new conversation */
  reset: () => void;
}

// ============ Initial State ============

const initialProcessingDetails: ProcessingDetails = {
  phase: 'init',
  skills: [],
  toolsAvailable: [],
  toolsExecuted: [],
  isExpanded: false,
};

const initialState: StreamingState = {
  isStreaming: false,
  phase: null,
  currentContent: '',
  processingDetails: initialProcessingDetails,
  sources: [],
  visualizations: [],
  documents: [],
  error: null,
  errorRecoverable: false,
};

// ============ Hook ============

export function useStreamingChat(options: UseStreamingChatOptions = {}): UseStreamingChatReturn {
  const { onComplete, onError, onPhaseChange } = options;

  const [state, setState] = useState<StreamingState>(initialState);

  // Refs for chunk batching
  const contentBufferRef = useRef('');
  const rafRef = useRef<number | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Process a single SSE event
   */
  const processEvent = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case 'status':
        setState(prev => ({
          ...prev,
          phase: event.phase,
          processingDetails: {
            ...prev.processingDetails,
            phase: event.phase,
          },
        }));
        onPhaseChange?.(event.phase);
        break;

      case 'context_loaded':
        setState(prev => ({
          ...prev,
          processingDetails: {
            ...prev.processingDetails,
            skills: event.skills,
            toolsAvailable: event.toolsAvailable,
          },
        }));
        break;

      case 'tool_start':
        setState(prev => {
          const newTool: ToolExecutionState = {
            name: event.name,
            displayName: event.displayName,
            status: 'running',
            startTime: Date.now(),
          };
          return {
            ...prev,
            processingDetails: {
              ...prev.processingDetails,
              toolsExecuted: [...prev.processingDetails.toolsExecuted, newTool],
            },
          };
        });
        break;

      case 'tool_end':
        setState(prev => ({
          ...prev,
          processingDetails: {
            ...prev.processingDetails,
            toolsExecuted: prev.processingDetails.toolsExecuted.map(tool =>
              tool.name === event.name
                ? {
                    ...tool,
                    status: event.success ? 'success' : 'error',
                    duration: event.duration,
                    error: event.error,
                  }
                : tool
            ),
          },
        }));
        break;

      case 'artifact':
        if (event.subtype === 'visualization') {
          setState(prev => ({
            ...prev,
            visualizations: [...prev.visualizations, event.data],
          }));
        } else if (event.subtype === 'document') {
          setState(prev => ({
            ...prev,
            documents: [...prev.documents, event.data],
          }));
        }
        break;

      case 'sources':
        setState(prev => ({
          ...prev,
          sources: event.data,
        }));
        break;

      case 'chunk':
        // Use RAF batching for smooth updates
        contentBufferRef.current += event.content;
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            setState(prev => ({
              ...prev,
              currentContent: contentBufferRef.current,
            }));
            rafRef.current = undefined;
          });
        }
        break;

      case 'done':
        // Final flush of any remaining content
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = undefined;
        }
        setState(prev => {
          const finalContent = contentBufferRef.current || prev.currentContent;
          onComplete?.(event.messageId, finalContent, prev.sources, prev.visualizations, prev.documents);
          return {
            ...prev,
            isStreaming: false,
            phase: 'complete',
            currentContent: finalContent,
            processingDetails: {
              ...prev.processingDetails,
              phase: 'complete',
            },
          };
        });
        break;

      case 'error':
        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: event.message,
          errorRecoverable: event.recoverable,
        }));
        onError?.(event.code, event.message, event.recoverable);
        break;
    }
  }, [onComplete, onError, onPhaseChange]);

  /**
   * Send message and start streaming
   */
  const sendMessage = useCallback(async (message: string, threadId: string) => {
    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset state for new message
    contentBufferRef.current = '';
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }

    setState({
      ...initialState,
      isStreaming: true,
      phase: 'init',
      processingDetails: {
        ...initialProcessingDetails,
        phase: 'init',
      },
    });

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, threadId }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6)) as StreamEvent;
              processEvent(eventData);
            } catch {
              // Ignore malformed JSON
              console.warn('Failed to parse SSE event:', line);
            }
          }
          // Ignore comments (keep-alive) and empty lines
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User aborted, reset state
        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: null,
        }));
        return;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: message,
        errorRecoverable: true,
      }));
      onError?.('FETCH_ERROR', message, true);
    }
  }, [processEvent, onError]);

  /**
   * Abort current streaming
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
    setState(prev => ({
      ...prev,
      isStreaming: false,
    }));
  }, []);

  /**
   * Toggle processing details expansion
   */
  const toggleProcessingDetails = useCallback(() => {
    setState(prev => ({
      ...prev,
      processingDetails: {
        ...prev.processingDetails,
        isExpanded: !prev.processingDetails.isExpanded,
      },
    }));
  }, []);

  /**
   * Reset state for new conversation
   */
  const reset = useCallback(() => {
    abort();
    contentBufferRef.current = '';
    setState(initialState);
  }, [abort]);

  return {
    state,
    sendMessage,
    abort,
    toggleProcessingDetails,
    reset,
  };
}

export default useStreamingChat;
