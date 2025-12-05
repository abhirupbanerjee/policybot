'use client';

import { useState, useEffect } from 'react';
import ChatWindow from '@/components/chat/ChatWindow';
import ThreadSidebar from '@/components/layout/ThreadSidebar';
import type { Thread, UserSubscription } from '@/types';

export default function Home() {
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [userSubscriptions, setUserSubscriptions] = useState<UserSubscription[]>([]);
  const [brandingName, setBrandingName] = useState<string>('Policy Bot');

  // Load user subscriptions and branding on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load user subscriptions
        const subsResponse = await fetch('/api/user/subscriptions');
        if (subsResponse.ok) {
          const subsData = await subsResponse.json();
          setUserSubscriptions(subsData.subscriptions || []);
        }

        // Load branding
        const brandingResponse = await fetch('/api/branding');
        if (brandingResponse.ok) {
          const brandingData = await brandingResponse.json();
          setBrandingName(brandingData.botName || 'Policy Bot');
        }
      } catch (err) {
        console.error('Failed to load user data:', err);
      }
    };
    loadData();
  }, []);

  const handleThreadSelect = (thread: Thread | null) => {
    setActiveThread(thread);
  };

  const handleThreadCreated = (thread: Thread) => {
    setActiveThread(thread);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <ThreadSidebar
        onThreadSelect={handleThreadSelect}
        onThreadCreated={handleThreadCreated}
        selectedThreadId={activeThread?.id}
      />
      <main className="flex-1 flex flex-col lg:ml-0">
        <ChatWindow
          activeThread={activeThread}
          onThreadCreated={handleThreadCreated}
          userSubscriptions={userSubscriptions}
          brandingName={brandingName}
        />
      </main>
    </div>
  );
}
