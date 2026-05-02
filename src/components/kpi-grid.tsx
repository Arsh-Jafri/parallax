'use client';

import { useMemo } from 'react';
import type { PriceState, ArbitrageOpportunity, CryptoSymbol } from '@/lib/types';
import { EXCHANGES } from '@/lib/constants';
import { Ticker } from './ticker';
import { Sparkline } from './sparkline';

interface KpiGridProps {
  prices: PriceState;
  opportunities: ArbitrageOpportunity[];
  symbols: CryptoSymbol[];
}

function makeSpark(seed: number, n = 40, vol = 0.4): number[] {
  const arr = [seed];
  for (let i = 1; i < n; i++) arr.push(arr[i - 1] + (Math.random() - 0.5) * vol);
  return arr;
}

export function KpiGrid({ prices, opportunities, symbols }: KpiGridProps) {
  const sparks = useMemo(() => ({
    spread: makeSpark(0.5, 40, 0.3),
    price:  makeSpark(0.5, 40, 0.5),
    opps:   makeSpark(0.3, 40, 0.25),
    latency: makeSpark(0.5, 40, 0.15),
  }), []);

  // Use the first watched symbol as the headline mid-price
  const headlineSym = symbols[0];
  const headlinePrices = headlineSym ? EXCHANGES.map(ex => prices[ex]?.[headlineSym]).filter(Boolean) : [];
  const headlineMid = headlinePrices.length
    ? headlinePrices.reduce((s, p) => s + (p!.bid + p!.ask) / 2, 0) / headlinePrices.length
    : null;

  const bestOpp = opportunities[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      {/* Best net spread */}
      <div className="kpi">
        <div className="kpi-label">
          <span>Best net spread</span>
          {bestOpp && (
            <span className="chip chip--profit" style={{ fontSize: 10 }}>live</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          {bestOpp ? (
            <span className="ticker ticker--xl" style={{ color: 'var(--profit)' }}>
              +{bestOpp.profitPct.toFixed(3)}%
            </span>
          ) : (
            <span className="ticker ticker--xl" style={{ color: 'var(--fg-muted)' }}>—</span>
          )}
        </div>
        <div style={{ marginTop: 4 }}>
          <Sparkline data={sparks.spread} tone="profit" height={28}/>
        </div>
      </div>

      {/* Headline mid price */}
      <div className="kpi">
        <div className="kpi-label">Mid price · {headlineSym ?? '—'}/USD</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          {headlineMid ? (
            <Ticker value={headlineMid} size="xl" decimals={2} />
          ) : (
            <span className="ticker ticker--xl" style={{ color: 'var(--fg-muted)' }}>—</span>
          )}
        </div>
        <div style={{ marginTop: 4 }}>
          <Sparkline data={sparks.price} tone="accent" height={28}/>
        </div>
      </div>

      {/* Active opportunities */}
      <div className="kpi">
        <div className="kpi-label">Active opportunities</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="ticker ticker--xl">{opportunities.length}</span>
          {opportunities.length > 0 && (
            <span className="chip chip--profit">profitable</span>
          )}
        </div>
        <div style={{ marginTop: 4 }}>
          <Sparkline data={sparks.opps} tone="profit" height={28}/>
        </div>
      </div>

      {/* Connected feeds */}
      <div className="kpi">
        <div className="kpi-label">Connected feeds</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="ticker ticker--xl">
            {EXCHANGES.filter(ex => symbols.some(sym => prices[ex]?.[sym] != null)).length}
            <span style={{ fontSize: 18, color: 'var(--fg-tertiary)', fontWeight: 400 }}>/3</span>
          </span>
        </div>
        <div style={{ marginTop: 4 }}>
          <Sparkline data={sparks.latency} tone="accent" height={28}/>
        </div>
      </div>
    </div>
  );
}
