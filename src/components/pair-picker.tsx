'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PAIR_CATALOG } from '@/lib/constants';
import { CryptoIcon } from './crypto-icon';

interface PairPickerProps {
  watched: string[];
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="4.5"/><path d="M14 14l-3.5-3.5"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8"/>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 3v10M3 8h10"/>
    </svg>
  );
}

export function PairPicker({ watched, onAdd, onRemove }: PairPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const watchedSet = useMemo(() => new Set(watched), [watched]);

  const suggestions = useMemo(() => {
    const q = query.trim().toUpperCase();
    const pool = PAIR_CATALOG.filter(s => !watchedSet.has(s));
    if (!q) return pool.slice(0, 8);
    return pool.filter(s => s.startsWith(q)).slice(0, 8);
  }, [query, watchedSet]);

  // Allow adding a custom symbol that's not in the catalog
  const customCandidate = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,10}$/.test(q)) return null;
    if (watchedSet.has(q) || PAIR_CATALOG.includes(q)) return null;
    return q;
  }, [query, watchedSet]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function handleAdd(symbol: string) {
    onAdd(symbol);
    setQuery('');
    setOpen(false);
  }

  function handleEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    if (suggestions[0]) handleAdd(suggestions[0]);
    else if (customCandidate) handleAdd(customCandidate);
  }

  return (
    <div className="dash-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Watching
      </span>

      {watched.map(sym => (
        <span
          key={sym}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 6px 4px 8px',
            background: 'var(--bg-sunken)',
            border: '1px solid var(--border-default)',
            borderRadius: 999,
            fontSize: 12, fontFamily: 'var(--font-mono)',
            color: 'var(--fg-primary)',
          }}
        >
          <CryptoIcon symbol={sym} size={16} />
          {sym}/USD
          <button
            onClick={() => onRemove(sym)}
            disabled={watched.length <= 1}
            title={watched.length <= 1 ? 'At least one pair required' : `Remove ${sym}`}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: 999,
              background: 'transparent', border: 'none',
              color: 'var(--fg-tertiary)',
              cursor: watched.length <= 1 ? 'not-allowed' : 'pointer',
              opacity: watched.length <= 1 ? 0.4 : 1,
            }}
          >
            <XIcon />
          </button>
        </span>
      ))}

      <div ref={wrapRef} style={{ position: 'relative', marginLeft: 'auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px',
          background: 'var(--bg-sunken)',
          border: '1px solid var(--border-default)',
          borderRadius: 999,
          color: 'var(--fg-tertiary)',
        }}>
          <SearchIcon />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleEnter}
            placeholder="Add pair (e.g. SOL)"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--fg-primary)', width: 160,
            }}
          />
        </div>

        {open && (suggestions.length > 0 || customCandidate) && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            minWidth: 220,
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-md)',
            padding: 4,
            zIndex: 20,
          }}>
            {suggestions.map(sym => (
              <button
                key={sym}
                onMouseDown={e => { e.preventDefault(); handleAdd(sym); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '8px 10px',
                  background: 'transparent', border: 'none', borderRadius: 8,
                  color: 'var(--fg-primary)', fontFamily: 'var(--font-mono)', fontSize: 13,
                  cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CryptoIcon symbol={sym} size={18} />
                  {sym}/USD
                </span>
                <span style={{ color: 'var(--fg-tertiary)' }}><PlusIcon /></span>
              </button>
            ))}
            {customCandidate && (
              <button
                onMouseDown={e => { e.preventDefault(); handleAdd(customCandidate); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '8px 10px',
                  background: 'transparent', border: 'none', borderRadius: 8,
                  color: 'var(--fg-secondary)', fontFamily: 'var(--font-mono)', fontSize: 13,
                  cursor: 'pointer', textAlign: 'left',
                  borderTop: suggestions.length > 0 ? '1px solid var(--border-subtle)' : undefined,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span>Try {customCandidate}/USD</span>
                <span style={{ color: 'var(--fg-tertiary)' }}><PlusIcon /></span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
