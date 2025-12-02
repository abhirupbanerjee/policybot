'use client';

import { useState, useRef, useCallback } from 'react';
import { Paperclip, FileText, Upload, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';

interface FileUploadProps {
  threadId: string | null;
  currentUploads: string[];
  maxUploads?: number;
  onUploadComplete: (filename: string) => void;
  disabled?: boolean;
}

export default function FileUpload({
  threadId,
  currentUploads,
  maxUploads = 3,
  onUploadComplete,
  disabled,
}: FileUploadProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    if (!threadId) {
      setError('Please start a conversation first');
      return;
    }

    if (currentUploads.length >= maxUploads) {
      setError(`Maximum ${maxUploads} files per thread`);
      return;
    }

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File too large (max 5MB)');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/threads/${threadId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      onUploadComplete(data.filename);
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [threadId, currentUploads.length, maxUploads, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const remainingUploads = maxUploads - currentUploads.length;

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        disabled={disabled || !threadId}
        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Attach PDF"
      >
        <Paperclip size={20} />
      </button>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Upload Document"
      >
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-gray-600">Uploading...</p>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-2">
                Drag & drop a PDF here, or{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 hover:underline"
                >
                  browse
                </button>
              </p>
              <p className="text-sm text-gray-500">
                Max 5MB, PDF only
              </p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {currentUploads.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">
              Uploaded files ({currentUploads.length}/{maxUploads}):
            </p>
            <div className="space-y-2">
              {currentUploads.map((filename) => (
                <div
                  key={filename}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                >
                  <FileText size={16} className="text-blue-600" />
                  <span className="text-sm text-gray-700 truncate flex-1">
                    {filename}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {remainingUploads > 0 && (
          <p className="mt-4 text-sm text-gray-500">
            You can upload {remainingUploads} more file{remainingUploads !== 1 ? 's' : ''}
          </p>
        )}
      </Modal>
    </>
  );
}
