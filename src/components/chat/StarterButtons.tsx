'use client';

import { Sparkles } from 'lucide-react';

export interface StarterPrompt {
  label: string;
  prompt: string;
}

interface StarterButtonsProps {
  starters: StarterPrompt[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export default function StarterButtons({
  starters,
  onSelect,
  disabled = false,
}: StarterButtonsProps) {
  if (starters.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-center gap-2 mb-3 text-sm text-gray-500">
        <Sparkles size={16} style={{ color: 'var(--accent-color)' }} />
        <span>Quick start</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {starters.map((starter, index) => (
          <button
            key={index}
            onClick={() => onSelect(starter.prompt)}
            disabled={disabled}
            className="px-4 py-2 text-sm font-medium rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              color: 'var(--accent-text)',
              backgroundColor: 'var(--accent-lighter)',
              borderColor: 'var(--accent-border)',
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.backgroundColor = 'var(--accent-light)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-lighter)';
            }}
            title={starter.prompt}
          >
            {starter.label}
          </button>
        ))}
      </div>
    </div>
  );
}
