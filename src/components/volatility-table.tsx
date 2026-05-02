'use client';

import type { PriceState, Exchange, CryptoSymbol } from '@/lib/types';
import { EXCHANGES, EXCHANGE_FEES, STALE_THRESHOLD_MS } from '@/lib/constants';

interface VolatilityTableProps {
  prices: PriceState;
  symbols: CryptoSymbol[];
}

interface PairStats {
  symbol: CryptoSymbol;
  bestRawPct: number;
  bestNetPct: number;
  bestBuyEx: Exchange | null;
  bestSellEx: Exchange | null;
  routeCount: number;
}

const LABELS: Record<Exchange, string> = { gemini: 'GEM', coinbase: 'COB', kraken: 'KRK' };

function computePairStats(prices: PriceState, symbols: CryptoSymbol[]): PairStats[] {
  const now = Date.now();
  return symbols.map(symbol => {
    let bestRawPct = -Infinity;
    let bestNetPct = -Infinity;
    let bestBuyEx: Exchange | null = null;
    let bestSellEx: Exchange | null = null;
    let routeCount = 0;

    for (const buyEx of EXCHANGES as Exchange[]) {
      for (const sellEx of EXCHANGES as Exchange[]) {
        if (buyEx === sellEx) continue;
        const b = prices[buyEx]?.[symbol];
        const s = prices[sellEx]?.[symbol];
        if (!b || !s) continue;
        if (now - b.timestamp > STALE_THRESHOLD_MS) continue;
        if (now - s.timestamp > STALE_THRESHOLD_MS) continue;
        routeCount++;
        const rawPct = (s.bid - b.ask) / b.ask * 100;
        const netPct = rawPct - EXCHANGE_FEES[buyEx] * 100 - EXCHANGE_FEES[sellEx] * 100;
        if (rawPct > bestRawPct) {
          bestRawPct = rawPct;
          bestNetPct = netPct;
          bestBuyEx  = buyEx;
          bestSellEx = sellEx;
        }
      }
    }

    return {
      symbol,
      bestRawPct: bestRawPct === -Infinity ? 0 : bestRawPct,
      bestNetPct: bestNetPct === -Infinity ? 0 : bestNetPct,
      bestBuyEx,
      bestSellEx,
      routeCount,
    };
  })
  .filter(r => r.routeCount > 0)
  .sort((a, b) => Math.abs(b.bestRawPct) - Math.abs(a.bestRawPct));
}

// Simple inline bar: width proportional to absolute raw spread, max at 0.1%
function SpreadBar({ pct }: { pct: number }) {
  const w = Math.min(Math.abs(pct) / 0.10 * 100, 100);
  const color = pct > 0 ? 'var(--profit)' : 'var(--fg-muted)';
  return (
    <div style={{ width: 64, height: 6, background: 'var(--border-subtle)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
    </div>
  );
}

export function VolatilityTable({ prices, symbols }: VolatilityTableProps) {
  const rows = computePairStats(prices, symbols);

  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h3 className="dash-card-title">Pair divergence ranking</h3>
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>best route per pair · live</span>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '24px 18px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          Waiting for prices…
        </div>
      ) : (
        <table className="price-table">
          <thead>
            <tr>
              <th>Pair</th>
              <th>Best route</th>
              <th className="right">Raw spread</th>
              <th className="right">Net of fees</th>
              <th className="right" style={{ paddingRight: 16 }}>Width</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.symbol}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 20, textAlign: 'right', color: 'var(--fg-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      {i + 1}
                    </span>
                    <span style={{ fontWeight: 500 }}>{r.symbol}/USD</span>
                  </div>
                </td>
                <td>
                  {r.bestBuyEx && r.bestSellEx ? (
                    <span className="mono" style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>
                      {LABELS[r.bestBuyEx]}→{LABELS[r.bestSellEx]}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--fg-muted)' }}>—</span>
                  )}
                </td>
                <td className="right mono tnum" style={{ fontSize: 12, color: r.bestRawPct > 0 ? 'var(--profit)' : 'var(--fg-secondary)' }}>
                  {r.bestRawPct >= 0 ? '+' : ''}{r.bestRawPct.toFixed(3)}%
                </td>
                <td className="right" style={{ paddingRight: 0 }}>
                  <span className={`chip chip--${r.bestNetPct > 0 ? 'profit' : 'neutral'}`} style={{ fontSize: 10 }}>
                    {r.bestNetPct >= 0 ? '+' : ''}{r.bestNetPct.toFixed(3)}%
                  </span>
                </td>
                <td className="right" style={{ paddingRight: 16 }}>
                  <SpreadBar pct={r.bestRawPct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
