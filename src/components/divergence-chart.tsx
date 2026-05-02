'use client';

import { useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { ChartHistory } from '@/hooks/use-price-stream';
import type { CryptoSymbol } from '@/lib/types';
import { axisProps, gridProps, tooltipStyle, tooltipCursor, EX_COLORS, FONT, FG3 } from '@/lib/chart-style';

interface DivergenceChartProps {
  chartHistory: ChartHistory;
  symbols: CryptoSymbol[];
}

const EXCHANGES = ['gemini', 'coinbase', 'kraken'] as const;

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function DivergenceChart({ chartHistory, symbols }: DivergenceChartProps) {
  const [symbol, setSymbol] = useState<CryptoSymbol>(symbols[0] ?? 'BTC');

  const raw = chartHistory[symbol] ?? [];

  const data = raw.map(pt => {
    const vals = [pt.gemini, pt.coinbase, pt.kraken].filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return {
      ts: pt.ts,
      gemini:   pt.gemini   != null ? +((pt.gemini   - mean) / mean * 100).toFixed(4) : null,
      coinbase: pt.coinbase != null ? +((pt.coinbase - mean) / mean * 100).toFixed(4) : null,
      kraken:   pt.kraken   != null ? +((pt.kraken   - mean) / mean * 100).toFixed(4) : null,
    };
  }).filter(Boolean) as { ts: number; gemini: number | null; coinbase: number | null; kraken: number | null }[];

  const isEmpty = data.length < 2;

  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h3 className="dash-card-title">Price divergence</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Inline legend */}
          <div style={{ display: 'flex', gap: 14 }}>
            {EXCHANGES.map(ex => (
              <span key={ex} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: FG3, fontFamily: FONT }}>
                <span style={{ width: 16, height: 2, background: EX_COLORS[ex], display: 'inline-block', borderRadius: 1 }} />
                {ex}
              </span>
            ))}
          </div>
          <span style={{ fontSize: 11, color: FG3, fontFamily: FONT }}>% deviation from mean</span>
          {symbols.length > 1 && (
            <select
              value={symbol}
              onChange={e => setSymbol(e.target.value as CryptoSymbol)}
              style={{ background: 'var(--bg-raised)', color: 'var(--fg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}
            >
              {symbols.map(s => <option key={s} value={s}>{s}/USD</option>)}
            </select>
          )}
        </div>
      </div>
      <div style={{ padding: '4px 8px 16px 0' }}>
        {isEmpty ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
            Waiting for price data…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="ts"
                tickFormatter={fmt}
                {...axisProps}
                tick={{ ...axisProps.tick, fontSize: 10 }}
                minTickGap={90}
              />
              <YAxis
                tickFormatter={v => `${(v as number) >= 0 ? '+' : ''}${(v as number).toFixed(3)}%`}
                {...axisProps}
                width={68}
              />
              <Tooltip
                formatter={(value, name) => [`${(value as number) >= 0 ? '+' : ''}${(value as number).toFixed(4)}%`, name as string]}
                labelFormatter={t => fmt(t as number)}
                contentStyle={tooltipStyle}
                cursor={tooltipCursor}
              />
              {EXCHANGES.map(ex => (
                <Line
                  key={ex}
                  type="monotone"
                  dataKey={ex}
                  stroke={EX_COLORS[ex]}
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
