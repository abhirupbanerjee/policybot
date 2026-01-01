'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Mail, Link2, Calendar, Download, Loader2, Trash2, ExternalLink } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { ThreadShare, CreateShareRequest } from '@/types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  threadId: string;
  threadTitle: string;
}

interface ShareConfig {
  expiresInDays: number | null;
  allowDownload: boolean;
  sendEmail: boolean;
  recipientEmail: string;
}

export default function ShareModal({
  isOpen,
  onClose,
  threadId,
  threadTitle,
}: ShareModalProps) {
  const [shares, setShares] = useState<ThreadShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [shareEnabled, setShareEnabled] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [config, setConfig] = useState<ShareConfig>({
    expiresInDays: 7,
    allowDownload: true,
    sendEmail: false,
    recipientEmail: '',
  });

  // Load existing shares and check tool availability
  useEffect(() => {
    if (isOpen) {
      loadShares();
      checkToolStatus();
    }
  }, [isOpen, threadId]);

  const checkToolStatus = async () => {
    try {
      const response = await fetch('/api/tools/status');
      if (response.ok) {
        const data = await response.json();
        setShareEnabled(data.share_thread?.enabled ?? true);
        setEmailEnabled(data.send_email?.enabled ?? false);
      }
    } catch (err) {
      console.error('Failed to check tool status:', err);
    }
  };

  const loadShares = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/threads/${threadId}/share`);
      if (response.ok) {
        const data = await response.json();
        setShares(data.shares || []);
      } else if (response.status === 403) {
        const data = await response.json();
        setShareEnabled(false);
        setError(data.error || 'Thread sharing is disabled');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to load shares');
      }
    } catch (err) {
      console.error('Failed to load shares:', err);
      setError('Failed to load shares');
    } finally {
      setLoading(false);
    }
  };

  const createShare = async () => {
    setCreating(true);
    setError(null);
    try {
      const body: CreateShareRequest = {
        allowDownload: config.allowDownload,
        expiresInDays: config.expiresInDays,
      };

      if (config.sendEmail && config.recipientEmail) {
        body.sendEmail = true;
        body.recipientEmail = config.recipientEmail;
      }

      const response = await fetch(`/api/threads/${threadId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        setShares((prev) => [data.share, ...prev]);
        // Copy the new share link
        if (data.share.shareUrl) {
          await copyToClipboard(data.share.shareUrl, data.share.id);
        }
        // Show email error if email was requested but failed
        if (config.sendEmail && data.emailError) {
          setError(`Share created but email failed: ${data.emailError}`);
        }
        // Reset email fields
        setConfig((prev) => ({ ...prev, sendEmail: false, recipientEmail: '' }));
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create share');
      }
    } catch (err) {
      console.error('Failed to create share:', err);
      setError('Failed to create share');
    } finally {
      setCreating(false);
    }
  };

  const revokeShare = async (shareId: string) => {
    setDeletingId(shareId);
    try {
      const response = await fetch(`/api/shares/${shareId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setShares((prev) => prev.filter((s) => s.id !== shareId));
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to revoke share');
      }
    } catch (err) {
      console.error('Failed to revoke share:', err);
      setError('Failed to revoke share');
    } finally {
      setDeletingId(null);
    }
  };

  const copyToClipboard = async (text: string, shareId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(shareId);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatExpiry = (expiresAt: string | Date | null) => {
    if (!expiresAt) return 'Never expires';
    const d = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    const now = new Date();
    if (d < now) return 'Expired';
    const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 1) return 'Expires tomorrow';
    if (days < 7) return `Expires in ${days} days`;
    return `Expires ${formatDate(d)}`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Thread">
      {!shareEnabled ? (
        <div className="text-center py-4">
          <p className="text-gray-600 mb-4">
            Thread sharing is currently disabled by your administrator.
          </p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Create new share */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Create New Share Link</h3>

            {/* Expiry selection */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">Link Expiry</label>
              <select
                value={config.expiresInDays ?? 'never'}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    expiresInDays: e.target.value === 'never' ? null : parseInt(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="never">Never expires</option>
              </select>
            </div>

            {/* Allow downloads */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.allowDownload}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, allowDownload: e.target.checked }))
                }
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Allow recipients to download files</span>
            </label>

            {/* Email notification (only if send_email tool is enabled) */}
            {emailEnabled && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.sendEmail}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, sendEmail: e.target.checked }))
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Send email notification</span>
                </label>

                {config.sendEmail && (
                  <input
                    type="email"
                    value={config.recipientEmail}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, recipientEmail: e.target.value }))
                    }
                    placeholder="recipient@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
            )}

            <Button
              onClick={createShare}
              loading={creating}
              disabled={config.sendEmail && !config.recipientEmail}
              className="w-full"
            >
              <Link2 size={16} className="mr-2" />
              Create Share Link
            </Button>
          </div>

          {/* Existing shares */}
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : shares.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900">
                Active Share Links ({shares.filter((s) => s.isActive).length})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className={`border rounded-lg p-3 ${
                      share.isActive ? 'border-gray-200' : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar size={14} className="text-gray-400 shrink-0" />
                          <span className="text-gray-600">
                            {formatExpiry(share.expiresAt)}
                          </span>
                          {share.allowDownload && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                              <Download size={10} />
                              Downloads
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Created {formatDate(share.createdAt)} • {share.viewCount} views
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {share.isActive && share.shareUrl && (
                          <>
                            <button
                              onClick={() => copyToClipboard(share.shareUrl!, share.id)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                              title="Copy link"
                            >
                              {copied === share.id ? (
                                <Check size={16} className="text-green-500" />
                              ) : (
                                <Copy size={16} />
                              )}
                            </button>
                            <a
                              href={share.shareUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                              title="Open in new tab"
                            >
                              <ExternalLink size={16} />
                            </a>
                          </>
                        )}
                        {share.isActive && (
                          <button
                            onClick={() => revokeShare(share.id)}
                            disabled={deletingId === share.id}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Revoke share"
                          >
                            {deletingId === share.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {!share.isActive && (
                      <span className="inline-block mt-1 text-xs text-red-600">
                        {share.isExpired ? 'Expired' : 'Revoked'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              No share links yet. Create one above.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
