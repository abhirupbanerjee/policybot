'use client';

import { FileText } from 'lucide-react';
import type { Source } from '@/types';

interface SourceCardProps {
  source: Source;
}

export default function SourceCard({ source }: SourceCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 text-sm">
      <div className="flex items-center gap-2 text-blue-600 mb-1">
        <FileText size={14} />
        <span className="font-medium truncate">{source.documentName}</span>
        {source.pageNumber > 0 && (
          <span className="text-gray-500 text-xs">Page {source.pageNumber}</span>
        )}
      </div>
      <p className="text-gray-600 text-xs line-clamp-2">
        {source.chunkText}
      </p>
    </div>
  );
}
