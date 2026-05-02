'use client';

import { useState, useEffect } from 'react';
import type { ConnectionState } from '@/hooks/use-price-stream';

interface TopBarProps {
  connState: ConnectionState;
  lastUpdated: number | null;
}

function BellIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 11h9l-1-1.5V7a3.5 3.5 0 1 0-7 0v2.5L3.5 11z"/>
      <path d="M6.5 13a1.5 1.5 0 0 0 3 0"/>
    </svg>
  );
}

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

export function TopBar({ connState, lastUpdated }: TopBarProps) {
  const [now, setNow]           = useState(Date.now());
  const [theme, setTheme]       = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  function toggleTheme(next: 'dark' | 'light') {
    setTheme(next);
    const html = document.documentElement;
    html.setAttribute('data-theme', next);
    if (next === 'light') {
      html.classList.remove('dark');
    } else {
      html.classList.add('dark');
    }
  }

  const age = lastUpdated ? Math.max(0, Math.floor((now - lastUpdated) / 1000)) : null;
  const dotKind  = connState === 'error' ? 'offline' : age !== null && age < 30 ? 'live' : age !== null ? 'stale' : 'stale';
  const dotLabel = connState === 'error'
    ? 'disconnected'
    : age !== null ? `All feeds live · ${age}s` : 'connecting…';

  // In light mode the logo PNG has a black bg — switch to the black-text version
  const logoSrc = theme === 'light' ? '/parallax-black-text.png' : '/parallax-white-text.png';

  return (
    <div className="dash-topbar" style={{ padding: 0 }}>
      <div style={{
        maxWidth: 1320,
        width: '100%',
        margin: '0 auto',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt="Parallax"
          style={{
            height: 80,
            width: 'auto',
            display: 'block',
            mixBlendMode: theme === 'dark' ? 'screen' : 'multiply',
          }}
        />

        <nav className="dash-nav">
          <a className="active">Live</a>
          <a>History</a>
          <a>Alerts</a>
        </nav>

        <div className="dash-right">
        <span className={`status-dot ${dotKind}`}>{dotLabel}</span>

        {/* Theme switcher */}
        <div style={{
          display: 'inline-flex',
          gap: 2,
          padding: 3,
          background: 'var(--bg-sunken)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 999,
        }}>
          <button
            className="btn-icon"
            onClick={() => toggleTheme('dark')}
            title="Dark mode"
            style={{
              width: 30, height: 30,
              background: theme === 'dark' ? 'var(--accent-soft)' : 'transparent',
              color: theme === 'dark' ? 'var(--accent-color)' : 'var(--fg-tertiary)',
              border: 'none',
            }}
          >
            <MoonIcon />
          </button>
          <button
            className="btn-icon"
            onClick={() => toggleTheme('light')}
            title="Light mode"
            style={{
              width: 30, height: 30,
              background: theme === 'light' ? 'var(--accent-soft)' : 'transparent',
              color: theme === 'light' ? 'var(--accent-color)' : 'var(--fg-tertiary)',
              border: 'none',
            }}
          >
            <SunIcon />
          </button>
        </div>

          <button className="btn-icon"><BellIcon /></button>
        </div>
      </div>
    </div>
  );
}
