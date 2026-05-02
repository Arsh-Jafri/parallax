'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PriceState, ArbitrageOpportunity, SSEPayload, NormalizedPrice, Exchange, CryptoSymbol } from '@/lib/types';
import { EXCHANGES, DEFAULT_SYMBOLS } from '@/lib/constants';

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

  return { symbols, prices, opportunities, connState, lastUpdated, addSymbol, removeSymbol };
}
