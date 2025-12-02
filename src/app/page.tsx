'use client';

import { useState } from 'react';
import ChatWindow from '@/components/chat/ChatWindow';
import ThreadSidebar from '@/components/layout/ThreadSidebar';
import type { Thread } from '@/types';

export default function Home() {
  const [activeThread, setActiveThread] = useState<Thread | null>(null);

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
        />
      </main>
    </div>
  );
}
