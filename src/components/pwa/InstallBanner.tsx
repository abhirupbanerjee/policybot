'use client';

import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, X } from 'lucide-react';

export function InstallBanner() {
  const { showBanner, installApp, dismissPrompt } = usePWAInstall();

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      <div className="mx-auto max-w-lg p-4">
        <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-900 px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
              <Download className="h-5 w-5 text-white" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-white">Install App</p>
              <p className="text-gray-400">Add to home screen for quick access</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={installApp}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Install
            </button>
            <button
              onClick={dismissPrompt}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
