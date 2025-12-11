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
        <Sparkles size={16} className="text-blue-500" />
        <span>Quick start</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {starters.map((starter, index) => (
          <button
            key={index}
            onClick={() => onSelect(starter.prompt)}
            disabled={disabled}
            className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full hover:bg-blue-100 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={starter.prompt}
          >
            {starter.label}
          </button>
        ))}
      </div>
    </div>
  );
}
