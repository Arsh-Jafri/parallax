'use client';

import type { PriceState, Exchange, CryptoSymbol } from '@/lib/types';
import { EXCHANGES, EXCHANGE_FEES, STALE_THRESHOLD_MS } from '@/lib/constants';

interface SpreadMatrixProps {
  prices: PriceState;
  symbols: CryptoSymbol[];
}

const LABELS: Record<Exchange, string> = {
  gemini:   'Gemini',
  coinbase: 'Coinbase',
  kraken:   'Kraken',
};

function computeNet(prices: PriceState, buy: Exchange, sell: Exchange, symbols: CryptoSymbol[]): number | null {
  // Use first symbol where both exchanges have a fresh price
  const now = Date.now();
  for (const sym of symbols) {
    const b = prices[buy]?.[sym];
    const s = prices[sell]?.[sym];
    if (!b || !s) continue;
    if (now - b.timestamp > STALE_THRESHOLD_MS) continue;
    if (now - s.timestamp > STALE_THRESHOLD_MS) continue;
    const raw = (s.bid - b.ask) / b.ask * 100;
    return +(raw - EXCHANGE_FEES[buy] * 100 - EXCHANGE_FEES[sell] * 100).toFixed(3);
  }
  return null;
}

function matrixTone(v: number | null): string {
  if (v == null) return 'self';
  if (v > 0.30) return 'profit-4';
  if (v > 0.20) return 'profit-3';
  if (v > 0.10) return 'profit-2';
  if (v > 0)    return 'profit-1';
  if (v < -0.20) return 'loss-2';
  if (v < 0)    return 'loss-1';
  return '';
}

export function SpreadMatrix({ prices, symbols }: SpreadMatrixProps) {
  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h3 className="dash-card-title">Spread matrix</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>net of fees</span>
          <div className="legend">
            <span className="item">
              <span className="swatch-dot" style={{ background: 'color-mix(in oklab, var(--loss) 16%, var(--bg-sunken))' }}></span>
              loss
            </span>
            <span className="item">
              <span className="swatch-dot" style={{ background: 'color-mix(in oklab, var(--profit) 40%, var(--bg-sunken))' }}></span>
              profit
            </span>
          </div>
        </div>
      </div>
      <div style={{ padding: '16px 18px 20px' }}>
        <div className="matrix">
          {/* header row */}
          <div className="head" style={{ paddingBottom: 10 }}></div>
          {(EXCHANGES as Exchange[]).map(ex => (
            <div key={ex} className="head">{LABELS[ex]}</div>
          ))}

          {/* data rows */}
          {(EXCHANGES as Exchange[]).map(buyEx => (
            <div key={buyEx} style={{ display: 'contents' }}>
              <div className="row-head">{LABELS[buyEx]}</div>
              {(EXCHANGES as Exchange[]).map(sellEx => {
                if (buyEx === sellEx) {
                  return (
                    <div key={sellEx} className="cell self">
                      <span style={{ color: 'var(--fg-muted)', fontSize: 18 }}>—</span>
                    </div>
                  );
                }
                const v = computeNet(prices, buyEx, sellEx, symbols);
                const tone = matrixTone(v);
                return (
                  <div key={sellEx} className={`cell ${tone}`}>
                    {v == null ? (
                      <span style={{ color: 'var(--fg-muted)' }}>—</span>
                    ) : (
                      <>
                        <span className="label">{buyEx.slice(0,3).toUpperCase()} → {sellEx.slice(0,3).toUpperCase()}</span>
                        <span className="val">{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-start' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--fg-muted)' }}>
            row = buy exchange · column = sell exchange · avg BTC/ETH bid/ask
          </span>
        </div>
      </div>
    </div>
  );
}
