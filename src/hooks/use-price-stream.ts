'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PriceState, ArbitrageOpportunity, SSEPayload, NormalizedPrice, Exchange, CryptoSymbol } from '@/lib/types';
import { EXCHANGES, DEFAULT_SYMBOLS } from '@/lib/constants';

// Rolling price history: last N mid-prices per symbol (for sparklines)
export type PriceHistory = Record<CryptoSymbol, number[]>;
const HISTORY_LEN = 60;

// Per-exchange price snapshots for divergence chart
export interface PricePoint { ts: number; gemini: number | null; coinbase: number | null; kraken: number | null; }
export type ChartHistory = Record<CryptoSymbol, PricePoint[]>;
const CHART_LEN = 120;

function emptyPriceState(symbols: CryptoSymbol[]): PriceState {
  return Object.fromEntries(
    EXCHANGES.map(ex => [
      ex,
      Object.fromEntries(symbols.map(sym => [sym, null])),
    ])
  ) as PriceState;
}

export type ConnectionState = 'connecting' | 'open' | 'error';

export function usePriceStream() {
  const [symbols, setSymbols]         = useState<CryptoSymbol[]>(DEFAULT_SYMBOLS);
  const [prices, setPrices]           = useState<PriceState>(() => emptyPriceState(DEFAULT_SYMBOLS));
  const [opportunities, setOpps]      = useState<ArbitrageOpportunity[]>([]);
  const [connState, setConnState]     = useState<ConnectionState>('connecting');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [priceHistory, setPriceHistory]   = useState<PriceHistory>({});
  const [chartHistory, setChartHistory]   = useState<ChartHistory>({});
  const historyRef    = useRef<PriceHistory>({});
  const chartRef      = useRef<ChartHistory>({});
  // Track latest known mid-price per exchange per symbol for chart point construction
  const latestRef     = useRef<Partial<Record<Exchange, Partial<Record<CryptoSymbol, number>>>>>({});

  useEffect(() => {
    const es = new EventSource('/api/stream');

    es.onopen  = () => setConnState('open');
    es.onerror = () => setConnState('error');

    es.onmessage = (event) => {
      const payload: SSEPayload = JSON.parse(event.data);

      if (payload.type === 'symbols') {
        setSymbols(payload.data);
      } else if (payload.type === 'price_snapshot') {
        setPrices(payload.data);
      } else if (payload.type === 'price') {
        const p = payload.data as NormalizedPrice;
        setPrices(prev => ({
          ...prev,
          [p.exchange as Exchange]: {
            ...prev[p.exchange as Exchange],
            [p.symbol as CryptoSymbol]: p,
          },
        }));
        setLastUpdated(Date.now());
        // Accumulate mid-price history for sparklines
        const mid = (p.bid + p.ask) / 2;
        historyRef.current = {
          ...historyRef.current,
          [p.symbol]: [...(historyRef.current[p.symbol] ?? []), mid].slice(-HISTORY_LEN),
        };
        setPriceHistory({ ...historyRef.current });

        // Track latest per-exchange mid for chart
        if (!latestRef.current[p.exchange as Exchange]) latestRef.current[p.exchange as Exchange] = {};
        latestRef.current[p.exchange as Exchange]![p.symbol] = mid;
        const latest = latestRef.current;
        const point: PricePoint = {
          ts:       Date.now(),
          gemini:   latest.gemini?.[p.symbol]   ?? null,
          coinbase: latest.coinbase?.[p.symbol] ?? null,
          kraken:   latest.kraken?.[p.symbol]   ?? null,
        };
        chartRef.current = {
          ...chartRef.current,
          [p.symbol]: [...(chartRef.current[p.symbol] ?? []), point].slice(-CHART_LEN),
        };
        setChartHistory({ ...chartRef.current });
      } else if (payload.type === 'opportunities') {
        setOpps(payload.data as ArbitrageOpportunity[]);
      }
    };

    return () => es.close();
  }, []);

  const addSymbol = useCallback(async (symbol: string) => {
    await fetch('/api/pairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol }),
    });
  }, []);

  const removeSymbol = useCallback(async (symbol: string) => {
    await fetch(`/api/pairs?symbol=${encodeURIComponent(symbol)}`, { method: 'DELETE' });
  }, []);

  return { symbols, prices, opportunities, connState, lastUpdated, priceHistory, chartHistory, addSymbol, removeSymbol };
}
