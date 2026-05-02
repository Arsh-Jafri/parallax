'use client';

import { useState, useEffect } from 'react';
import type { PriceState, Exchange, CryptoSymbol } from '@/lib/types';
import { EXCHANGES, EXCHANGE_FEES, STALE_THRESHOLD_MS } from '@/lib/constants';
import { Ticker } from './ticker';
import { CryptoIcon } from './crypto-icon';

interface PriceCardProps {
  symbol: CryptoSymbol;
  prices: PriceState;
}

function ExchangeMark({ exchange }: { exchange: Exchange }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/${exchange}.png`}
      alt={exchange}
      style={{ width: 28, height: 28, borderRadius: 8, display: 'block', flexShrink: 0 }}
    />
  );
}

function ageStr(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
}

function ageColor(ts: number): string {
  const s = (Date.now() - ts) / 1000;
  if (s > 10) return 'var(--loss)';
  if (s > 5)  return 'var(--warn)';
  return 'var(--fg-tertiary)';
}

export function PriceCard({ symbol, prices }: PriceCardProps) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const hasAny = EXCHANGES.some(ex => prices[ex]?.[symbol] != null);

  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h3 className="dash-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CryptoIcon symbol={symbol} size={20} />
          {symbol} / USD
        </h3>
        <span className={`status-dot ${hasAny ? 'live' : 'stale'}`}>
          {hasAny ? '' : 'connecting'}
        </span>
      </div>

      <div style={{ padding: 0 }}>
        <table className="price-table">
          <thead>
            <tr>
              <th>Exchange</th>
              <th className="right">Bid</th>
              <th className="right">Ask</th>
              <th className="right" style={{ paddingRight: 16 }}>Age</th>
            </tr>
          </thead>
          <tbody>
            {(EXCHANGES as Exchange[]).map(exchange => {
              const p = prices[exchange]?.[symbol] ?? null;
              const stale = p && Date.now() - p.timestamp > STALE_THRESHOLD_MS;
              const feeLabel = `${(EXCHANGE_FEES[exchange] * 100).toFixed(2)}%`;

              if (!p) {
                return (
                  <tr key={exchange} style={{ opacity: 0.4 }}>
                    <td>
                      <div className="exchange-cell">
                        <ExchangeMark exchange={exchange} />
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--fg-primary)', textTransform: 'capitalize' }}>{exchange}</div>
                          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>fee {feeLabel}</div>
                        </div>
                      </div>
                    </td>
                    <td className="right" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>—</td>
                    <td className="right" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>—</td>
                    <td className="right" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', paddingRight: 16 }}>—</td>
                  </tr>
                );
              }

              return (
                <tr key={exchange} style={{ opacity: stale ? 0.5 : 1 }}>
                  <td>
                    <div className="exchange-cell">
                      <ExchangeMark exchange={exchange} />
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--fg-primary)', textTransform: 'capitalize' }}>{exchange}</div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>fee {feeLabel}</div>
                      </div>
                    </div>
                  </td>
                  <td className="right">
                    <Ticker value={p.bid} size="md" decimals={2} />
                  </td>
                  <td className="right">
                    <Ticker value={p.ask} size="md" decimals={2} />
                  </td>
                  <td className="right mono" style={{ color: ageColor(p.timestamp), paddingRight: 16 }}>{ageStr(p.timestamp)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
