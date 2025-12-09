'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, RefreshCw, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import type { Message, Thread, UserSubscription } from '@/types';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import Spinner from '@/components/ui/Spinner';

interface ChatWindowProps {
  activeThread?: Thread | null;
  onThreadCreated?: (thread: Thread) => void;
  userSubscriptions?: UserSubscription[];
  brandingName?: string;
}

interface ThreadSummary {
  summary: string;
  messagesSummarized: number;
  createdAt: string;
}

export default function ChatWindow({ activeThread, onThreadCreated, userSubscriptions = [], brandingName = 'Policy Bot' }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploads, setUploads] = useState<string[]>([]);
  const [showSummaryDetails, setShowSummaryDetails] = useState(false);
  const [summaryData, setSummaryData] = useState<ThreadSummary | null>(null);

  // Compute dynamic header based on subscriptions
  const getHeaderInfo = () => {
    const activeSubscriptions = userSubscriptions.filter(s => s.isActive);

    if (activeSubscriptions.length === 0) {
      // No subscriptions (admin/superuser) - use branding
      return {
        title: brandingName,
        subtitle: `Ask questions about policy documents`,
      };
    } else if (activeSubscriptions.length === 1) {
      // Single subscription - use category name
      const categoryName = activeSubscriptions[0].categoryName;
      return {
        title: `${categoryName} Assistant`,
        subtitle: `Ask questions about ${categoryName}`,
      };
    } else {
      // Multiple subscriptions - GEA Global Assistant
      return {
        title: 'GEA Global Assistant',
        subtitle: 'Ask questions about GEA Global',
      };
    }
  };

  const headerInfo = getHeaderInfo();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load thread messages when active thread changes
  useEffect(() => {
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
  }, [activeThread]);

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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          threadId: currentThreadId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send message');
      }

      const data = await response.json();

      // Replace temp user message and add assistant response
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== userMessage.id);
        return [
          ...filtered,
          { ...userMessage, id: `user-${Date.now()}` },
          {
            ...data.message,
            timestamp: new Date(data.message.timestamp),
          },
        ];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setLoading(false);
    }
  }, [threadId, createThread]);

  const handleUploadComplete = (filename: string) => {
    setUploads((prev) => [...prev, filename]);
  };

  const retry = () => {
    setError(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">
          {activeThread?.title || headerInfo.title}
        </h1>
        <p className="text-sm text-gray-500">
          {headerInfo.subtitle}
        </p>
      </header>

      {/* Summarization Banner */}
      {activeThread?.isSummarized && summaryData && (
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-3">
          <button
            onClick={() => setShowSummaryDetails(!showSummaryDetails)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2 text-blue-700">
              <BookOpen size={18} />
              <span className="text-sm font-medium">
                This conversation has been summarized ({summaryData.messagesSummarized} messages compressed)
              </span>
            </div>
            {showSummaryDetails ? (
              <ChevronUp size={18} className="text-blue-600" />
            ) : (
              <ChevronDown size={18} className="text-blue-600" />
            )}
          </button>
          {showSummaryDetails && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
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
              Welcome to {headerInfo.title}
            </h2>
            <p className="text-gray-500 max-w-md">
              {headerInfo.subtitle} or upload a document to check
              for compliance. Start by typing a question below.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {loading && (
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
      />
    </div>
  );
}
