'use client';

import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm flex items-center justify-center gap-2 safe-area-top">
      <WifiOff size={16} />
      <span>You&apos;re offline. Some features may be unavailable.</span>
    </div>
  );
}
