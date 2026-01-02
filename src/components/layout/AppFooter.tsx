'use client';

import { AlertTriangle } from 'lucide-react';

export default function AppFooter() {
  return (
    <footer className="bg-amber-50 border-t border-amber-200 px-4 py-2">
      <div className="flex items-center justify-center gap-2">
        <AlertTriangle size={14} className="text-amber-600 shrink-0" />
        <p className="text-xs text-amber-700">
          This is AI generated response. Please verify the information.
        </p>
      </div>
    </footer>
  );
}
