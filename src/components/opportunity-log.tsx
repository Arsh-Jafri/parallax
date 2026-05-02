'use client';

import { useState, useEffect, useRef } from 'react';
import type { ArbitrageOpportunity } from '@/lib/types';
import { MIN_PROFIT_PCT } from '@/lib/constants';

interface OpportunityLogProps {
  opportunities: ArbitrageOpportunity[];
}

interface LogEntry extends ArbitrageOpportunity {
  seenAt: number;
}

function ArrowRight() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4"/>
    </svg>
  );
}

function fmt(n: number, dp = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function OpportunityLog({ opportunities }: OpportunityLogProps) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const seenKeys = useRef(new Set<string>());

  useEffect(() => {
    for (const opp of opportunities) {
      const key = `${opp.symbol}-${opp.buyExchange}-${opp.sellExchange}-${opp.profitPct.toFixed(4)}`;
      if (!seenKeys.current.has(key)) {
        seenKeys.current.add(key);
        setLog(prev => [{ ...opp, seenAt: Date.now() }, ...prev].slice(0, 20));
      }
    }
  }, [opportunities]);

  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  function timeLabel(seenAt: number) {
    const s = Math.floor((Date.now() - seenAt) / 1000);
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  }

  const exLabel: Record<string, string> = { gemini: 'Gemini', coinbase: 'Coinbase', kraken: 'Kraken' };

  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h3 className="dash-card-title">Opportunity log</h3>
        {log.length > 0 && (
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{log.length} detected</span>
        )}
      </div>

      <div>
        {log.length === 0 ? (
          <div style={{ padding: '24px 18px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            No fee-adjusted opportunities detected
          </div>
        ) : (
          log.map((o, i) => {
            const live = o.profitPct >= MIN_PROFIT_PCT;
            return (
              <div key={i} className="opp-row">
                <span className="mono tnum" style={{ color: 'var(--fg-tertiary)', fontSize: 11, whiteSpace: 'nowrap' }}>
                  {timeLabel(o.seenAt)}
                </span>
                <span className="opp-route">
                  <span style={{ color: 'var(--fg-primary)', textTransform: 'capitalize' }}>{exLabel[o.buyExchange]}</span>
                  <span style={{ color: 'var(--fg-muted)' }}><ArrowRight /></span>
                  <span style={{ color: 'var(--fg-primary)', textTransform: 'capitalize' }}>{exLabel[o.sellExchange]}</span>
                  <span style={{ color: 'var(--fg-muted)', marginLeft: 4 }}>{o.symbol}</span>
                </span>
                <span className="mono tnum" style={{ color: 'var(--fg-tertiary)', fontSize: 11 }}>
                  raw {fmt((o.grossSpread / o.buyAsk) * 100, 3)}%
                </span>
                <span className={`chip chip--${live ? 'profit' : 'neutral'}`}>
                  +{o.profitPct.toFixed(3)}%
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
