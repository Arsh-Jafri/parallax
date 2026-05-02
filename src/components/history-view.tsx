'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { PageShell } from './page-shell';
import type { SpreadSnapshot, ArbitrageOpportunity } from '@/lib/types';
import { axisProps, gridProps, tooltipStyle, tooltipCursor, FONT, FG3 } from '@/lib/chart-style';

type Range = '1H' | '6H' | '24H' | '7D';

interface ChartPoint {
  time: number;
  [combo: string]: number | null;
}

const COMBOS = [
  { key: 'gemini→coinbase',  color: '#c47a3a' },   // orange
  { key: 'gemini→kraken',    color: '#4a7ab5' },   // blue
  { key: 'coinbase→gemini',  color: '#7c5ea8' },   // purple
  { key: 'coinbase→kraken',  color: '#4e9e7a' },   // teal
  { key: 'kraken→gemini',    color: '#b85a6a' },   // rose
  { key: 'kraken→coinbase',  color: '#8a8a3a' },   // olive
];

function formatTime(ts: number, range: Range): string {
  const d = new Date(ts);
  if (range === '7D') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function buildChartData(snapshots: SpreadSnapshot[]): ChartPoint[] {
  // Bucket by timestamp rounding to nearest 10s for display
  const buckets = new Map<number, Record<string, number>>();
  for (const s of snapshots) {
    const t = Math.round(s.capturedAt / 10000) * 10000;
    if (!buckets.has(t)) buckets.set(t, {});
    const key = `${s.exchangeBuy}→${s.exchangeSell}`;
    buckets.get(t)![key] = s.netSpread;
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, vals]) => ({ time, ...vals }));
}

function fmt(n: number, dp = 3) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function HistoryView() {
  const [pair,       setPair]       = useState('BTC');
  const [range,      setRange]      = useState<Range>('1H');
  const [pairs,      setPairs]      = useState<string[]>(['BTC', 'ETH']);
  const [chartData,  setChartData]  = useState<ChartPoint[]>([]);
  const [oppLog,     setOppLog]     = useState<ArbitrageOpportunity[]>([]);
  const [loading,    setLoading]    = useState(false);

  // Fetch available pairs
  useEffect(() => {
    fetch('/api/pairs').then(r => r.json()).then(d => {
      if (Array.isArray(d.watched) && d.watched.length > 0) setPairs(d.watched);
    }).catch(() => {});
  }, []);

  const fetchHistory = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/history/spreads?pair=${pair}&range=${range}`).then(r => r.json()),
      fetch(`/api/history/opportunities?range=${range}`).then(r => r.json()),
    ]).then(([spreadsRes, oppsRes]) => {
      const snapshots: SpreadSnapshot[] = spreadsRes.data ?? [];
      setChartData(buildChartData(snapshots));
      const allOpps: ArbitrageOpportunity[] = oppsRes.data ?? [];
      setOppLog(allOpps.filter(o => o.symbol === pair).reverse().slice(0, 100));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [pair, range]);

  useEffect(() => {
    fetchHistory();
    const id = setInterval(fetchHistory, 10_000);
    return () => clearInterval(id);
  }, [fetchHistory]);

  const exLabel: Record<string, string> = { gemini: 'Gemini', coinbase: 'Coinbase', kraken: 'Kraken' };

  return (
    <PageShell>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--fg-tertiary)', fontSize: 13 }}>Pair</span>
          <select
            value={pair}
            onChange={e => setPair(e.target.value)}
            style={{ background: 'var(--bg-card)', color: 'var(--fg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '4px 8px', fontSize: 13 }}
          >
            {pairs.map(p => <option key={p} value={p}>{p}/USD</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {(['1H', '6H', '24H', '7D'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                background: range === r ? 'var(--accent-soft)' : 'transparent',
                color: range === r ? 'var(--accent-color)' : 'var(--fg-secondary)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {loading && <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>loading…</span>}
      </div>

      {/* Spread chart */}
      <div className="dash-card" style={{ marginBottom: 16 }}>
        <div className="dash-card-head">
          <h3 className="dash-card-title">Net spread over time · {pair}/USD</h3>
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>after taker fees</span>
        </div>
        <div style={{ padding: '8px 18px 20px' }}>
          {chartData.length === 0 ? (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
              {loading ? 'Loading…' : 'No spread history yet — data accumulates every 5 seconds'}
            </div>
          ) : (
            <>
              {/* Inline legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', padding: '0 4px 10px', marginLeft: 56 }}>
                {COMBOS.map(c => (
                  <span key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: FG3, fontFamily: FONT }}>
                    <span style={{ width: 14, height: 2, background: c.color, display: 'inline-block', borderRadius: 1 }} />
                    {c.key}
                  </span>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis
                    dataKey="time"
                    tickFormatter={t => formatTime(t as number, range)}
                    {...axisProps}
                    minTickGap={60}
                  />
                  <YAxis
                    tickFormatter={v => `${(v as number).toFixed(2)}%`}
                    {...axisProps}
                    width={56}
                  />
                  <Tooltip
                    formatter={(value) => [`${(value as number)?.toFixed(3) ?? '—'}%`]}
                    labelFormatter={t => formatTime(t as number, range)}
                    contentStyle={tooltipStyle}
                    cursor={tooltipCursor}
                  />
                  {COMBOS.map(c => (
                    <Line
                      key={c.key}
                      type="monotone"
                      dataKey={c.key}
                      stroke={c.color}
                      dot={false}
                      strokeWidth={1.5}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>

      {/* Opportunity log */}
      <div className="dash-card">
        <div className="dash-card-head">
          <h3 className="dash-card-title">Opportunity log · {pair}/USD · {range}</h3>
          {oppLog.length > 0 && (
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{oppLog.length} entries</span>
          )}
        </div>
        {oppLog.length === 0 ? (
          <div style={{ padding: '24px 18px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            No profitable opportunities recorded in this window
          </div>
        ) : (
          <table className="price-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Route</th>
                <th className="right">Buy ask</th>
                <th className="right">Sell bid</th>
                <th className="right">Raw spread</th>
                <th className="right" style={{ paddingRight: 16 }}>Net profit</th>
              </tr>
            </thead>
            <tbody>
              {oppLog.map((o, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{timeAgo(o.timestamp)}</td>
                  <td>
                    <span style={{ fontSize: 12 }}>
                      <span style={{ textTransform: 'capitalize' }}>{exLabel[o.buyExchange]}</span>
                      <span style={{ color: 'var(--fg-muted)', margin: '0 4px' }}>→</span>
                      <span style={{ textTransform: 'capitalize' }}>{exLabel[o.sellExchange]}</span>
                    </span>
                  </td>
                  <td className="right mono tnum" style={{ fontSize: 12 }}>${fmt(o.buyAsk, 2)}</td>
                  <td className="right mono tnum" style={{ fontSize: 12 }}>${fmt(o.sellBid, 2)}</td>
                  <td className="right mono tnum" style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
                    {fmt((o.grossSpread / o.buyAsk) * 100)}%
                  </td>
                  <td className="right" style={{ paddingRight: 16 }}>
                    <span className="chip chip--profit">+{o.profitPct.toFixed(3)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageShell>
  );
}
