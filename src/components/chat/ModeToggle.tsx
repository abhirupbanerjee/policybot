'use client';

import { Bot, MessageSquare } from 'lucide-react';

export type ChatMode = 'normal' | 'autonomous';

interface ModeToggleProps {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  disabled?: boolean;
}

export default function ModeToggle({
  mode,
  onModeChange,
  disabled,
}: ModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Mode Toggle */}
      <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1">
        <button
          type="button"
          onClick={() => onModeChange('normal')}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            mode === 'normal'
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <MessageSquare size={16} />
          <span>Normal</span>
        </button>
        <button
          type="button"
          onClick={() => onModeChange('autonomous')}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            mode === 'autonomous'
              ? 'bg-purple-100 text-purple-900'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Bot size={16} />
          <span>Autonomous</span>
        </button>
      </div>

      {/* Info tooltip for autonomous mode */}
      {mode === 'autonomous' && (
        <span className="text-xs text-purple-600">
          Models configured by admin
        </span>
      )}
    </div>
  );
}
