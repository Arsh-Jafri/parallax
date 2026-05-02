'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { PageShell } from './page-shell';
import type { ArbitrageOpportunity } from '@/lib/types';

type Range = '1H' | '6H' | '24H' | '7D';

interface HourBucket {
  hour: string;
  count: number;
  avgProfit: number;
}

interface PairCount {
  route: string;
  count: number;
  avgProfit: number;
}

function buildHourBuckets(opps: ArbitrageOpportunity[]): HourBucket[] {
  const buckets: Record<number, { count: number; totalProfit: number }> = {};
  for (const o of opps) {
    const h = new Date(o.timestamp).getHours();
    if (!buckets[h]) buckets[h] = { count: 0, totalProfit: 0 };
    buckets[h].count++;
    buckets[h].totalProfit += o.profitPct;
  }
  return Array.from({ length: 24 }, (_, h) => ({
    hour: `${h.toString().padStart(2, '0')}:00`,
    count: buckets[h]?.count ?? 0,
    avgProfit: buckets[h] ? +(buckets[h].totalProfit / buckets[h].count).toFixed(3) : 0,
  }));
}

function buildRouteCounts(opps: ArbitrageOpportunity[]): PairCount[] {
  const buckets: Record<string, { count: number; totalProfit: number }> = {};
  for (const o of opps) {
    const key = `${o.buyExchange.slice(0,3).toUpperCase()}→${o.sellExchange.slice(0,3).toUpperCase()} ${o.symbol}`;
    if (!buckets[key]) buckets[key] = { count: 0, totalProfit: 0 };
    buckets[key].count++;
    buckets[key].totalProfit += o.profitPct;
  }
  return Object.entries(buckets)
    .map(([route, v]) => ({ route, count: v.count, avgProfit: +(v.totalProfit / v.count).toFixed(3) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export function StatsView() {
  const [range, setRange]       = useState<Range>('24H');
  const [opps, setOpps]         = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading]   = useState(false);

  const fetchStats = useCallback(() => {
    setLoading(true);
    fetch(`/api/history/opportunities?range=${range}`)
      .then(r => r.json())
      .then(d => setOpps(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 15_000);
    return () => clearInterval(id);
  }, [fetchStats]);

  const hourBuckets  = buildHourBuckets(opps);
  const routeCounts  = buildRouteCounts(opps);
  const bestRoute    = routeCounts[0];
  const totalCount   = opps.length;
  const avgPct       = opps.length > 0 ? opps.reduce((s, o) => s + o.profitPct, 0) / opps.length : 0;

  return (
    <PageShell>
      {/* Range selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ color: 'var(--fg-tertiary)', fontSize: 13 }}>Window</span>
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
        {loading && <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>loading…</span>}
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-label">Total opportunities</div>
          <span className="ticker ticker--xl">{totalCount.toLocaleString()}</span>
        </div>
        <div className="kpi">
          <div className="kpi-label">Avg net profit</div>
          <span className="ticker ticker--xl" style={{ color: totalCount > 0 ? 'var(--profit)' : 'var(--fg-muted)' }}>
            {totalCount > 0 ? `+${avgPct.toFixed(3)}%` : '—'}
          </span>
        </div>
        <div className="kpi">
          <div className="kpi-label">Best route</div>
          <span className="ticker ticker--xl" style={{ fontSize: 18, color: 'var(--fg-primary)' }}>
            {bestRoute?.route ?? '—'}
          </span>
        </div>
      </div>

      {/* Best spread window by hour */}
      <div className="dash-card" style={{ marginBottom: 16 }}>
        <div className="dash-card-head">
          <h3 className="dash-card-title">Opportunities by hour of day</h3>
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>UTC</span>
        </div>
        <div style={{ padding: '8px 18px 20px' }}>
          {totalCount === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              No opportunity data in this window
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourBuckets} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--fg-tertiary)', fontFamily: 'var(--font-mono)' }} interval={3} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--fg-tertiary)', fontFamily: 'var(--font-mono)' }} width={36} />
                <Tooltip
                  formatter={(v) => [v as number, 'count']}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#5d92ff" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Most frequently profitable routes */}
      <div className="dash-card">
        <div className="dash-card-head">
          <h3 className="dash-card-title">Most profitable routes</h3>
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>by occurrence</span>
        </div>
        <div style={{ padding: '8px 18px 20px' }}>
          {routeCounts.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              No opportunity data in this window
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={routeCounts} layout="vertical" margin={{ top: 4, right: 60, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--fg-tertiary)', fontFamily: 'var(--font-mono)' }} />
                <YAxis type="category" dataKey="route" width={110} tick={{ fontSize: 11, fill: 'var(--fg-secondary)', fontFamily: 'var(--font-mono)' }} />
                <Tooltip
                  formatter={(v, name) => [name === 'count' ? v as number : `${(v as number).toFixed(3)}%`, name === 'count' ? 'occurrences' : 'avg profit']}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#34d3a0" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </PageShell>
  );
}
