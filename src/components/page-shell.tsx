'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.8"/>
      <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.05 3.05l1.13 1.13M11.82 11.82l1.13 1.13M3.05 12.95l1.13-1.13M11.82 4.18l1.13-1.13"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 9.5A5.5 5.5 0 1 1 6.5 2.5a4.5 4.5 0 0 0 7 7z"/>
    </svg>
  );
}

interface PageShellProps {
  children: React.ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  const pathname  = usePathname();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = document.documentElement.getAttribute('data-theme') as 'dark' | 'light' | null;
    if (saved) setTheme(saved);
  }, []);

  function toggleTheme(next: 'dark' | 'light') {
    setTheme(next);
    const html = document.documentElement;
    html.setAttribute('data-theme', next);
    if (next === 'light') html.classList.remove('dark');
    else html.classList.add('dark');
  }

  const logoSrc = theme === 'light' ? '/parallax-black-text.png' : '/parallax-white-text.png';

  return (
    <>
      <div className="dash-topbar" style={{ padding: 0 }}>
        <div style={{ maxWidth: 1320, width: '100%', margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="Parallax" style={{ height: 80, width: 'auto', display: 'block', mixBlendMode: theme === 'dark' ? 'screen' : 'multiply' }} />

          <nav className="dash-nav">
            <Link href="/" className={pathname === '/' ? 'active' : ''}>Live</Link>
            <Link href="/history" className={pathname === '/history' ? 'active' : ''}>History</Link>
            <Link href="/stats" className={pathname === '/stats' ? 'active' : ''}>Stats</Link>
          </nav>

          <div className="dash-right">
            <div style={{ display: 'inline-flex', gap: 2, padding: 3, background: 'var(--bg-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 999 }}>
              <button className="btn-icon" onClick={() => toggleTheme('dark')} title="Dark mode" style={{ width: 30, height: 30, background: theme === 'dark' ? 'var(--accent-soft)' : 'transparent', color: theme === 'dark' ? 'var(--accent-color)' : 'var(--fg-tertiary)', border: 'none' }}>
                <MoonIcon />
              </button>
              <button className="btn-icon" onClick={() => toggleTheme('light')} title="Light mode" style={{ width: 30, height: 30, background: theme === 'light' ? 'var(--accent-soft)' : 'transparent', color: theme === 'light' ? 'var(--accent-color)' : 'var(--fg-tertiary)', border: 'none' }}>
                <SunIcon />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 24px 80px' }}>
        {children}
      </div>
    </>
  );
}
