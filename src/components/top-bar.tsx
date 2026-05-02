'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ConnectionState } from '@/hooks/use-price-stream';

interface TopBarProps {
  connState?: ConnectionState;
  lastUpdated?: number | null;
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

export function TopBar({ connState = 'open', lastUpdated = null }: TopBarProps) {
  const [now, setNow]     = useState(Date.now());
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const pathname          = usePathname();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  function toggleTheme(next: 'dark' | 'light') {
    setTheme(next);
    const html = document.documentElement;
    html.setAttribute('data-theme', next);
    if (next === 'light') html.classList.remove('dark');
    else html.classList.add('dark');
  }

  const age      = lastUpdated ? Math.max(0, Math.floor((now - lastUpdated) / 1000)) : null;
  const dotKind  = connState === 'error' ? 'offline' : age !== null && age < 30 ? 'live' : age !== null ? 'stale' : 'stale';
  const dotLabel = connState === 'error' ? 'disconnected' : age !== null ? 'live' : 'connecting…';
  const logoSrc  = theme === 'light' ? '/black-text-logo.png' : '/white-text-logo.png';

  const navLinks = [
    { href: '/',        label: 'Live' },
    { href: '/history', label: 'History' },
    { href: '/stats',   label: 'Stats' },
  ];

  return (
    <div className="dash-topbar" style={{ padding: 0 }}>
      <div style={{
        maxWidth: 1320,
        width: '100%',
        margin: '0 auto',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'stretch',
        height: 72,
        gap: 32,
      }}>
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt="Parallax"
          style={{
            height: 60,
            width: 'auto',
            alignSelf: 'center',
            display: 'block',
            mixBlendMode: theme === 'dark' ? 'screen' : 'multiply',
            flexShrink: 0,
          }}
        />

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
          {navLinks.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 14px',
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--fg-primary)' : 'var(--fg-tertiary)',
                  textDecoration: 'none',
                  borderBottom: active ? '2px solid var(--fg-primary)' : '2px solid transparent',
                  transition: 'color 120ms ease, border-color 120ms ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--fg-secondary)';
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--fg-tertiary)';
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="dash-right">
          <span className={`status-dot ${dotKind}`}>{dotLabel}</span>

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
                width: 28, height: 28,
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
                width: 28, height: 28,
                background: theme === 'light' ? 'var(--accent-soft)' : 'transparent',
                color: theme === 'light' ? 'var(--accent-color)' : 'var(--fg-tertiary)',
                border: 'none',
              }}
            >
              <SunIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
