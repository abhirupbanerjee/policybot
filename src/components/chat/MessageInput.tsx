'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import VoiceInput from './VoiceInput';
import FileUpload from './FileUpload';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  threadId: string | null;
  currentUploads: string[];
  onUploadComplete: (filename: string) => void;
}

export default function MessageInput({
  onSend,
  disabled,
  threadId,
  currentUploads,
  onUploadComplete,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setMessage((prev) => prev + (prev ? ' ' : '') + text);
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t bg-white p-4 safe-area-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      {currentUploads.length > 0 && (
        <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
            {currentUploads.length} file{currentUploads.length !== 1 ? 's' : ''} attached
          </span>
        </div>
      )}

      <div className="flex items-end gap-2">
        <FileUpload
          threadId={threadId}
          currentUploads={currentUploads}
          onUploadComplete={onUploadComplete}
          disabled={disabled}
        />

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question..."
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
        </div>

        <VoiceInput onTranscript={handleVoiceTranscript} disabled={disabled} />

        <button
          onClick={handleSubmit}
          disabled={disabled || !message.trim()}
          className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
