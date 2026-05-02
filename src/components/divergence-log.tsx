'use client';

import { useState } from 'react';
import type { PriceState, Exchange, CryptoSymbol } from '@/lib/types';
import { EXCHANGES, EXCHANGE_FEES, STALE_THRESHOLD_MS } from '@/lib/constants';

interface DivergenceLogProps {
  prices: PriceState;
  symbols: CryptoSymbol[];
}

interface SpreadRow {
  symbol: CryptoSymbol;
  buyExchange: Exchange;
  sellExchange: Exchange;
  buyAsk: number;
  sellBid: number;
  rawPct: number;
  netPct: number;
}

const LABELS: Record<Exchange, string> = { gemini: 'Gemini', coinbase: 'Coinbase', kraken: 'Kraken' };

function computeAllSpreads(prices: PriceState, symbols: CryptoSymbol[]): SpreadRow[] {
  const now = Date.now();
  const rows: SpreadRow[] = [];
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
        rows.push({ symbol, buyExchange: buyEx, sellExchange: sellEx, buyAsk: b.ask, sellBid: s.bid, rawPct, netPct });
      }
    }
  }
  return rows.sort((a, b) => b.rawPct - a.rawPct);
}

function fmt(n: number, dp = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function DivergenceLog({ prices, symbols }: DivergenceLogProps) {
  const [symbol, setSymbol] = useState<CryptoSymbol>(symbols[0] ?? 'BTC');
  const rows = computeAllSpreads(prices, [symbol]);

  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h3 className="dash-card-title">Divergence log</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {rows.length > 0 && (
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{rows.length} routes · live</span>
          )}
          {symbols.length > 1 && (
            <select
              value={symbol}
              onChange={e => setSymbol(e.target.value as CryptoSymbol)}
              style={{ background: 'var(--bg-card)', color: 'var(--fg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}
            >
              {symbols.map(s => <option key={s} value={s}>{s}/USD</option>)}
            </select>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '24px 18px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          Waiting for prices from all exchanges…
        </div>
      ) : (
        <table className="price-table">
          <thead>
            <tr>
              <th>Route</th>
              <th className="right">Buy ask</th>
              <th className="right">Sell bid</th>
              <th className="right">Raw spread</th>
              <th className="right" style={{ paddingRight: 16 }}>Net of fees</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <span style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--fg-muted)', fontSize: 11, fontFamily: 'var(--font-mono)', marginRight: 6 }}>{r.symbol}</span>
                    <span style={{ textTransform: 'capitalize' }}>{LABELS[r.buyExchange]}</span>
                    <span style={{ color: 'var(--fg-muted)', margin: '0 4px' }}>→</span>
                    <span style={{ textTransform: 'capitalize' }}>{LABELS[r.sellExchange]}</span>
                  </span>
                </td>
                <td className="right mono tnum" style={{ fontSize: 12 }}>${fmt(r.buyAsk, 2)}</td>
                <td className="right mono tnum" style={{ fontSize: 12 }}>${fmt(r.sellBid, 2)}</td>
                <td className="right mono tnum" style={{ fontSize: 12, color: r.rawPct > 0 ? 'var(--profit)' : 'var(--fg-secondary)' }}>
                  {r.rawPct >= 0 ? '+' : ''}{r.rawPct.toFixed(3)}%
                </td>
                <td className="right" style={{ paddingRight: 16 }}>
                  <span className={`chip chip--${r.netPct > 0 ? 'profit' : 'neutral'}`}>
                    {r.netPct >= 0 ? '+' : ''}{r.netPct.toFixed(3)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
