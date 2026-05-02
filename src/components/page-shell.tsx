'use client';

import { TopBar } from './top-bar';
import { Footer } from './footer';

interface PageShellProps {
  children: React.ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  return (
    <>
      <TopBar />
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 24px 40px' }}>
        {children}
      </div>
      <Footer />
    </>
  );
}
