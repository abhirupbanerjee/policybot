'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageSquare, RefreshCw, BookOpen, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import type { Message, Thread, UserSubscription, Source, MessageVisualization, GeneratedDocumentInfo, GeneratedImageInfo, UrlSource } from '@/types';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import Spinner from '@/components/ui/Spinner';
import StarterButtons, { StarterPrompt } from './StarterButtons';
import ProcessingIndicator from './ProcessingIndicator';
import ShareModal from '@/components/sharing/ShareModal';
import ArtifactsPanel from './ArtifactsPanel';
import { useStreamingChat } from '@/hooks/useStreamingChat';

interface WelcomeConfig {
  title?: string;
  message?: string;
}

interface ChatWindowProps {
  activeThread?: Thread | null;
  onThreadCreated?: (thread: Thread) => void;
  userSubscriptions?: UserSubscription[];
  brandingName?: string;
  brandingSubtitle?: string;           // Custom subtitle from branding settings
  globalWelcome?: WelcomeConfig;       // Global welcome fallback from branding
  categoryWelcome?: WelcomeConfig;     // Per-category welcome (takes priority)
}

interface ThreadSummary {
  summary: string;
  messagesSummarized: number;
  createdAt: string;
}

export default function ChatWindow({
  activeThread,
  onThreadCreated,
  userSubscriptions = [],
  brandingName = 'Policy Bot',
  brandingSubtitle,
  globalWelcome,
  categoryWelcome,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploads, setUploads] = useState<string[]>([]);
  const [urlSources, setUrlSources] = useState<UrlSource[]>([]);
  const [showSummaryDetails, setShowSummaryDetails] = useState(false);
  const [summaryData, setSummaryData] = useState<ThreadSummary | null>(null);
  const [starterPrompts, setStarterPrompts] = useState<StarterPrompt[]>([]);
  const [loadingStarters, setLoadingStarters] = useState(false);
  const [fetchedCategoryWelcome, setFetchedCategoryWelcome] = useState<WelcomeConfig | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Compute dynamic header based on subscriptions
  const getHeaderInfo = () => {
    const activeSubscriptions = userSubscriptions.filter(s => s.isActive);

    if (activeSubscriptions.length === 0) {
      // No subscriptions (admin/superuser) - use branding
      return {
        title: brandingName,
        subtitle: brandingSubtitle || `Ask questions about policy documents`,
      };
    } else if (activeSubscriptions.length === 1) {
      // Single subscription - use category name
      const categoryName = activeSubscriptions[0].categoryName;
      return {
        title: `${categoryName} Assistant`,
        subtitle: brandingSubtitle || `Ask questions about ${categoryName}`,
      };
    } else {
      // Multiple subscriptions - GEA Global Assistant
      return {
        title: 'GEA Global Assistant',
        subtitle: brandingSubtitle || 'Ask questions about GEA Global',
      };
    }
  };

  const headerInfo = getHeaderInfo();

  // Compute welcome screen content with priority: fetched category > prop category > global > default
  const getWelcomeContent = () => {
    // Priority 1: Fetched category-specific welcome (from API)
    if (fetchedCategoryWelcome?.title || fetchedCategoryWelcome?.message) {
      return {
        title: fetchedCategoryWelcome.title || `Welcome to ${headerInfo.title}`,
        message: fetchedCategoryWelcome.message || headerInfo.subtitle,
      };
    }
    // Priority 2: Prop-passed category-specific welcome
    if (categoryWelcome?.title || categoryWelcome?.message) {
      return {
        title: categoryWelcome.title || `Welcome to ${headerInfo.title}`,
        message: categoryWelcome.message || headerInfo.subtitle,
      };
    }
    // Priority 3: Global branding welcome
    if (globalWelcome?.title || globalWelcome?.message) {
      return {
        title: globalWelcome.title || `Welcome to ${headerInfo.title}`,
        message: globalWelcome.message || headerInfo.subtitle,
      };
    }
    // Priority 4: Hardcoded fallback
    return {
      title: `Welcome to ${headerInfo.title}`,
      message: headerInfo.subtitle,
    };
  };

  const welcomeContent = getWelcomeContent();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Compute generated docs and images from all messages for ArtifactsPanel
  const { generatedDocs, generatedImages } = useMemo(() => {
    const docs: GeneratedDocumentInfo[] = [];
    const images: GeneratedImageInfo[] = [];
    for (const msg of messages) {
      if (msg.generatedDocuments) docs.push(...msg.generatedDocuments);
      if (msg.generatedImages) images.push(...msg.generatedImages);
    }
    return { generatedDocs: docs, generatedImages: images };
  }, [messages]);

  // Streaming chat hook
  const handleStreamComplete = useCallback((
    messageId: string,
    content: string,
    sources: Source[],
    visualizations: MessageVisualization[],
    documents: GeneratedDocumentInfo[],
    images: GeneratedImageInfo[]
  ) => {
    // Add completed assistant message to the list
    const assistantMessage: Message = {
      id: messageId,
      role: 'assistant',
      content,
      sources: sources.length > 0 ? sources : undefined,
      visualizations: visualizations.length > 0 ? visualizations : undefined,
      generatedDocuments: documents.length > 0 ? documents : undefined,
      generatedImages: images.length > 0 ? images : undefined,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);
    setLoading(false);
  }, []);

  const handleStreamError = useCallback((code: string, message: string) => {
    setError(message);
    setLoading(false);
  }, []);

  const {
    state: streamingState,
    sendMessage: sendStreamingMessage,
    // abort: abortStreaming, // Available for future use (e.g., cancel button)
    toggleProcessingDetails,
    reset: resetStreaming,
  } = useStreamingChat({
    onComplete: handleStreamComplete,
    onError: handleStreamError,
  });

  // Load thread messages when active thread changes
  useEffect(() => {
    // Reset streaming state when thread changes
    resetStreaming();

    if (activeThread) {
      setThreadId(activeThread.id);
      loadThread(activeThread.id);
      // Load summary data if thread is summarized
      if (activeThread.isSummarized) {
        loadSummaryData(activeThread.id);
      } else {
        setSummaryData(null);
      }
    } else {
      setThreadId(null);
      setMessages([]);
      setUploads([]);
      setSummaryData(null);
    }
  }, [activeThread, resetStreaming]);

  // Load starter prompts and category welcome for single-category threads
  useEffect(() => {
    const loadCategoryData = async () => {
      // Only load for threads with exactly one category and no messages
      if (!activeThread || messages.length > 0) {
        setStarterPrompts([]);
        setFetchedCategoryWelcome(null);
        return;
      }

      const categories = activeThread.categories || [];
      if (categories.length !== 1) {
        setStarterPrompts([]);
        setFetchedCategoryWelcome(null);
        return;
      }

      setLoadingStarters(true);
      try {
        const response = await fetch(`/api/categories/${categories[0].id}/prompt`);
        if (response.ok) {
          const data = await response.json();
          setStarterPrompts(data.starterPrompts || []);
          // Extract category welcome data
          if (data.welcomeTitle || data.welcomeMessage) {
            setFetchedCategoryWelcome({
              title: data.welcomeTitle || undefined,
              message: data.welcomeMessage || undefined,
            });
          } else {
            setFetchedCategoryWelcome(null);
          }
        }
      } catch (err) {
        console.error('Failed to load category data:', err);
      } finally {
        setLoadingStarters(false);
      }
    };

    loadCategoryData();
  }, [activeThread, messages.length]);

  // Clear starters when messages are sent
  useEffect(() => {
    if (messages.length > 0) {
      setStarterPrompts([]);
    }
  }, [messages.length]);

  const loadSummaryData = async (id: string) => {
    try {
      const response = await fetch(`/api/threads/${id}/summary`);
      if (response.ok) {
        const data = await response.json();
        if (data.hasSummary && data.summary) {
          setSummaryData({
            summary: data.summary.summary,
            messagesSummarized: data.summary.messagesSummarized,
            createdAt: data.summary.createdAt,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  };

  // Auto-scroll to bottom (on messages change or streaming content update)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingState.currentContent]);

  const loadThread = async (id: string) => {
    try {
      const response = await fetch(`/api/threads/${id}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })));
        setUploads(data.uploads || []);
      }
    } catch (err) {
      console.error('Failed to load thread:', err);
    }
  };

  const createThread = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const thread = await response.json();
        setThreadId(thread.id);
        onThreadCreated?.(thread);
        return thread.id;
      }
    } catch (err) {
      console.error('Failed to create thread:', err);
    }
    return null;
  }, [onThreadCreated]);

  const sendMessage = useCallback(async (content: string) => {
    setError(null);

    // Create thread if needed
    let currentThreadId = threadId;
    if (!currentThreadId) {
      currentThreadId = await createThread();
      if (!currentThreadId) {
        setError('Failed to create conversation');
        return;
      }
    }

    // Add user message optimistically
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    // Use streaming for response
    await sendStreamingMessage(content, currentThreadId);
  }, [threadId, createThread, sendStreamingMessage]);

  const handleUploadComplete = (filename: string) => {
    setUploads((prev) => [...prev, filename]);
  };

  const handleUrlSourceAdded = (source: {
    filename: string;
    originalUrl: string;
    sourceType: 'web' | 'youtube';
    title?: string;
  }) => {
    setUrlSources((prev) => [
      ...prev,
      {
        ...source,
        extractedAt: new Date().toISOString(),
      },
    ]);
  };

  const handleRemoveUpload = async (filename: string) => {
    if (!threadId) return;
    try {
      const response = await fetch(`/api/threads/${threadId}/upload?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setUploads((prev) => prev.filter((f) => f !== filename));
      }
    } catch (err) {
      console.error('Failed to remove upload:', err);
    }
  };

  const handleRemoveUrlSource = async (filename: string) => {
    if (!threadId) return;
    try {
      const response = await fetch(`/api/threads/${threadId}/upload?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setUrlSources((prev) => prev.filter((s) => s.filename !== filename));
      }
    } catch (err) {
      console.error('Failed to remove URL source:', err);
    }
  };

  const retry = () => {
    setError(null);
  };

  const handleStarterSelect = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="flex h-full">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white border-b px-4 sm:px-6 py-3 sm:py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-gray-900 text-center sm:text-left truncate">
              {activeThread?.title || headerInfo.title}
            </h1>
            <p className="text-sm text-gray-500 hidden sm:block">
              {headerInfo.subtitle}
            </p>
          </div>
          {activeThread && (
            <button
              onClick={() => setShowShareModal(true)}
              className="ml-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Share thread"
            >
              <Share2 size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Summarization Banner */}
      {activeThread?.isSummarized && summaryData && (
        <div
          className="border-b px-6 py-3"
          style={{
            backgroundColor: 'var(--accent-lighter)',
            borderColor: 'var(--accent-border)',
          }}
        >
          <button
            onClick={() => setShowSummaryDetails(!showSummaryDetails)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2" style={{ color: 'var(--accent-text)' }}>
              <BookOpen size={18} />
              <span className="text-sm font-medium">
                This conversation has been summarized ({summaryData.messagesSummarized} messages compressed)
              </span>
            </div>
            {showSummaryDetails ? (
              <ChevronUp size={18} style={{ color: 'var(--accent-color)' }} />
            ) : (
              <ChevronDown size={18} style={{ color: 'var(--accent-color)' }} />
            )}
          </button>
          {showSummaryDetails && (
            <div
              className="mt-3 p-3 bg-white rounded-lg border"
              style={{ borderColor: 'var(--accent-border)' }}
            >
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{summaryData.summary}</p>
              <p className="text-xs text-gray-500 mt-2">
                Summarized on {new Date(summaryData.createdAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mb-4" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              {welcomeContent.title}
            </h2>
            <p className="text-gray-500 max-w-md mb-6">
              {starterPrompts.length > 0
                ? 'Click a quick start button below or type your own question.'
                : `${welcomeContent.message} or upload a document to check for compliance. Start by typing a question below.`
              }
            </p>

            {/* Starter Prompts - only show for single-category threads */}
            {starterPrompts.length > 0 && (
              <div className="max-w-2xl w-full">
                <StarterButtons
                  starters={starterPrompts}
                  onSelect={handleStarterSelect}
                  disabled={loading || loadingStarters}
                />
              </div>
            )}
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Streaming UI */}
        {streamingState.isStreaming && (
          <>
            {/* Processing Indicator */}
            <ProcessingIndicator
              details={streamingState.processingDetails}
              onToggleExpand={toggleProcessingDetails}
            />

            {/* Streaming Message */}
            {streamingState.currentContent && (
              <MessageBubble
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingState.currentContent,
                  sources: streamingState.sources,
                  visualizations: streamingState.visualizations,
                  generatedDocuments: streamingState.documents,
                  generatedImages: streamingState.images,
                  timestamp: new Date(),
                }}
                isStreaming={true}
              />
            )}
          </>
        )}

        {/* Legacy loading indicator (fallback) */}
        {loading && !streamingState.isStreaming && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <span className="text-gray-600 text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center mb-4">
            <div className="bg-red-50 text-red-600 rounded-lg px-4 py-3 flex items-center gap-3">
              <span>{error}</span>
              <button
                onClick={retry}
                className="flex items-center gap-1 text-sm font-medium hover:underline"
              >
                <RefreshCw size={14} />
                Retry
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        disabled={loading}
        threadId={threadId}
        currentUploads={uploads}
        onUploadComplete={handleUploadComplete}
        onUrlSourceAdded={handleUrlSourceAdded}
      />

        {/* Share Modal */}
        {activeThread && (
          <ShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            threadId={activeThread.id}
            threadTitle={activeThread.title}
          />
        )}
      </div>

      {/* Artifacts Panel - Right Sidebar (hidden on mobile) */}
      <div className="hidden lg:block">
        <ArtifactsPanel
          threadId={threadId}
          uploads={uploads}
          generatedDocs={generatedDocs}
          generatedImages={generatedImages}
          urlSources={urlSources}
          onAddContent={() => {
            // Scroll to input area and focus
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          onRemoveUpload={handleRemoveUpload}
          onRemoveUrlSource={handleRemoveUrlSource}
        />
      </div>
    </div>
  );
}
