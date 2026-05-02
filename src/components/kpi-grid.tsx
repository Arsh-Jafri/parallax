'use client';

import { useState, useEffect } from 'react';
import type { PriceState, CryptoSymbol, Exchange } from '@/lib/types';
import { EXCHANGES, EXCHANGE_FEES, STALE_THRESHOLD_MS } from '@/lib/constants';
import type { PriceHistory } from '@/hooks/use-price-stream';
import { Ticker } from './ticker';
import { Sparkline } from './sparkline';

interface KpiGridProps {
  prices: PriceState;
  symbols: CryptoSymbol[];
  priceHistory: PriceHistory;
}

interface WidestSpread {
  rawPct: number;
  netPct: number;
  route: string;
  symbol: CryptoSymbol;
}

function findWidestSpread(prices: PriceState, symbols: CryptoSymbol[]): WidestSpread | null {
  const now = Date.now();
  let best: WidestSpread | null = null;
  for (const symbol of symbols) {
    for (const buyEx of EXCHANGES as Exchange[]) {
      for (const sellEx of EXCHANGES as Exchange[]) {
        if (buyEx === sellEx) continue;
        const b = prices[buyEx]?.[symbol];
        const s = prices[sellEx]?.[symbol];
        if (!b || !s) continue;
        if (now - b.timestamp > STALE_THRESHOLD_MS) continue;
        if (now - s.timestamp > STALE_THRESHOLD_MS) continue;
        const rawPct = (s.bid - b.ask) / b.ask * 100;
        const netPct = rawPct - EXCHANGE_FEES[buyEx] * 100 - EXCHANGE_FEES[sellEx] * 100;
        if (!best || rawPct > best.rawPct) {
          best = {
            rawPct,
            netPct,
            route: `${buyEx.slice(0, 3).toUpperCase()}→${sellEx.slice(0, 3).toUpperCase()}`,
            symbol,
          };
        }
      }
    }
  }
  return best;
}

function findLastUpdateMs(prices: PriceState, symbols: CryptoSymbol[]): number | null {
  let latest: number | null = null;
  for (const sym of symbols) {
    for (const ex of EXCHANGES as Exchange[]) {
      const ts = prices[ex]?.[sym]?.timestamp;
      if (ts && (!latest || ts > latest)) latest = ts;
    }
  }
  return latest;
}

function ageLabel(ms: number): string {
  const s = (Date.now() - ms) / 1000;
  if (s < 1)  return '<1s ago';
  if (s < 60) return `${s.toFixed(1)}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export function KpiGrid({ prices, symbols, priceHistory }: KpiGridProps) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const headlineSym = symbols[0];
  const headlineExPrices = headlineSym
    ? (EXCHANGES as Exchange[]).map(ex => prices[ex]?.[headlineSym]).filter(Boolean)
    : [];
  const headlineMid = headlineExPrices.length
    ? headlineExPrices.reduce((s, p) => s + (p!.bid + p!.ask) / 2, 0) / headlineExPrices.length
    : null;

  // % change vs. oldest point in rolling history
  const hist = headlineSym ? (priceHistory[headlineSym] ?? []) : [];
  const priceDelta = hist.length >= 2
    ? (hist[hist.length - 1] - hist[0]) / hist[0] * 100
    : null;

  // Widest raw spread across all watched pairs and routes
  const widest = findWidestSpread(prices, symbols);

  // Exchange gap: (max mid − min mid) / min mid * 100 for headline pair
  const mids = headlineExPrices.map(p => (p!.bid + p!.ask) / 2);
  const exGap = mids.length >= 2
    ? (Math.max(...mids) - Math.min(...mids)) / Math.min(...mids) * 100
    : null;

  // Last update age
  const lastUpdateMs = findLastUpdateMs(prices, symbols);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>

      {/* Widest raw spread */}
      <div className="kpi">
        <div className="kpi-label">
          <span>Widest spread</span>
          {widest && (
            <span className="mono" style={{ fontSize: 10, color: 'var(--fg-tertiary)' }}>
              {widest.route} · {widest.symbol}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {widest ? (
            <span className="ticker ticker--xl">
              {widest.rawPct >= 0 ? '+' : ''}{widest.rawPct.toFixed(3)}%
            </span>
          ) : (
            <span className="ticker ticker--xl" style={{ color: 'var(--fg-muted)' }}>—</span>
          )}
        </div>
        <div style={{ marginTop: 4, fontSize: 11, fontFamily: 'var(--font-mono)', color: widest && widest.netPct > 0 ? 'var(--profit)' : 'var(--fg-muted)' }}>
          {widest ? `net ${widest.netPct >= 0 ? '+' : ''}${widest.netPct.toFixed(3)}% after fees` : 'awaiting prices'}
        </div>
      </div>

      {/* Mid price + delta */}
      <div className="kpi">
        <div className="kpi-label">
          <span>Mid price · {headlineSym ?? '—'}/USD</span>
          {priceDelta != null && (
            <span style={{ fontSize: 11, color: 'var(--fg-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {priceDelta >= 0 ? '▲' : '▼'} {Math.abs(priceDelta).toFixed(3)}%
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          {headlineMid ? (
            <Ticker value={headlineMid} size="xl" decimals={2} />
          ) : (
            <span className="ticker ticker--xl" style={{ color: 'var(--fg-muted)' }}>—</span>
          )}
        </div>
        <div style={{ marginTop: 4 }}>
          <Sparkline data={hist} tone="accent" height={28} />
        </div>
      </div>

      {/* Exchange gap */}
      <div className="kpi">
        <div className="kpi-label">
          <span>Exchange gap · {headlineSym ?? '—'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {exGap != null ? (
            <span className="ticker ticker--xl">
              {exGap.toFixed(3)}%
            </span>
          ) : (
            <span className="ticker ticker--xl" style={{ color: 'var(--fg-muted)' }}>—</span>
          )}
        </div>
        <div style={{ marginTop: 4, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
          {mids.length >= 2
            ? `$${(Math.max(...mids) - Math.min(...mids)).toFixed(2)} max−min`
            : 'awaiting prices'}
        </div>
      </div>

      {/* Last update age */}
      <div className="kpi">
        <div className="kpi-label">Last tick</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {lastUpdateMs ? (
            <span className="ticker ticker--xl" style={{ fontSize: 22 }}>
              {ageLabel(lastUpdateMs)}
            </span>
          ) : (
            <span className="ticker ticker--xl" style={{ color: 'var(--fg-muted)' }}>—</span>
          )}
        </div>
        <div style={{ marginTop: 4, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
          {(EXCHANGES as Exchange[])
            .filter(ex => symbols.some(sym => prices[ex]?.[sym] != null))
            .map(ex => ex.slice(0, 3).toUpperCase())
            .join(' · ') || 'no feeds connected'}
        </div>
      </div>

    </div>
  );
}
