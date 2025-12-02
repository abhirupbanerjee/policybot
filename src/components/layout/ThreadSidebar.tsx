'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, MessageSquare, Trash2, Menu, X, Settings, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import type { Thread } from '@/types';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface ThreadSidebarProps {
  onThreadSelect?: (thread: Thread | null) => void;
  onThreadCreated?: (thread: Thread) => void;
  selectedThreadId?: string | null;
}

export default function ThreadSidebar({
  onThreadSelect,
  onThreadCreated,
  selectedThreadId,
}: ThreadSidebarProps) {
  const { data: session } = useSession();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteThread, setDeleteThread] = useState<Thread | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = (session?.user as { role?: string })?.role === 'admin';

  const loadThreads = useCallback(async () => {
    try {
      const response = await fetch('/api/threads');
      if (response.ok) {
        const data = await response.json();
        setThreads(data.threads.map((t: Thread) => ({
          ...t,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        })));
      }
    } catch (err) {
      console.error('Failed to load threads:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const createNewThread = async () => {
    try {
      const response = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const thread = await response.json();
        const newThread = {
          ...thread,
          createdAt: new Date(thread.createdAt),
          updatedAt: new Date(thread.updatedAt),
        };
        setThreads((prev) => [newThread, ...prev]);
        onThreadSelect?.(newThread);
        onThreadCreated?.(newThread);
        setIsOpen(false);
      }
    } catch (err) {
      console.error('Failed to create thread:', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteThread) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/threads/${deleteThread.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setThreads((prev) => prev.filter((t) => t.id !== deleteThread.id));
        if (selectedThreadId === deleteThread.id) {
          onThreadSelect?.(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete thread:', err);
    } finally {
      setDeleting(false);
      setDeleteThread(null);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const groupThreadsByDate = (threads: Thread[]) => {
    const groups: { [key: string]: Thread[] } = {};
    const now = new Date();

    threads.forEach((thread) => {
      const date = thread.updatedAt;
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      let key: string;
      if (days === 0) {
        key = 'Today';
      } else if (days === 1) {
        key = 'Yesterday';
      } else if (days < 7) {
        key = 'This Week';
      } else {
        key = 'Older';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(thread);
    });

    return groups;
  };

  const groupedThreads = groupThreadsByDate(threads);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-72 bg-white border-r flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-gray-900">Policy Bot</h1>
        </div>

        {/* New Thread Button */}
        <div className="p-4">
          <Button onClick={createNewThread} className="w-full">
            <Plus size={18} className="mr-2" />
            New Thread
          </Button>
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-pulse text-gray-400">Loading...</div>
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No threads yet</p>
              <p className="text-xs">Start a new conversation</p>
            </div>
          ) : (
            Object.entries(groupedThreads).map(([group, groupThreads]) => (
              <div key={group} className="mb-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase px-2 mb-2">
                  {group}
                </h3>
                <div className="space-y-1">
                  {groupThreads.map((thread) => (
                    <div
                      key={thread.id}
                      className={`
                        group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
                        ${selectedThreadId === thread.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'hover:bg-gray-100 text-gray-700'
                        }
                      `}
                      onClick={() => {
                        onThreadSelect?.(thread);
                        setIsOpen(false);
                      }}
                    >
                      <MessageSquare size={16} className="shrink-0 opacity-50" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {thread.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(thread.updatedAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteThread(thread);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with user info and admin link */}
        <div className="border-t p-4 space-y-2">
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Settings size={16} />
              Admin Dashboard
            </Link>
          )}
          {session?.user && (
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm shrink-0">
                  {session.user.name?.[0] || session.user.email?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {session.user.name || session.user.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteThread}
        onClose={() => setDeleteThread(null)}
        title="Delete Thread?"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete &quot;{deleteThread?.title}&quot;?
        </p>
        <p className="text-sm text-gray-500 mb-6">
          This will permanently remove all messages and uploaded documents.
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setDeleteThread(null)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleting}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
