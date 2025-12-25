'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import AccentColorProvider from '@/components/AccentColorProvider';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <AccentColorProvider>{children}</AccentColorProvider>
    </SessionProvider>
  );
}
