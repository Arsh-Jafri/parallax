import { EventEmitter } from 'events';
import type { NormalizedPrice, PriceState, ArbitrageOpportunity, Exchange, CryptoSymbol, SpreadSnapshot } from './types';
import { EXCHANGES, DEFAULT_SYMBOLS, OPPORTUNITY_THROTTLE_MS, PAIR_CATALOG, EXCHANGE_FEES, STALE_THRESHOLD_MS, SPREAD_SNAPSHOT_INTERVAL_MS, MAX_SPREAD_HISTORY, MAX_OPP_HISTORY } from './constants';
import { calculateArbitrage } from './arbitrage';
import { GeminiConnector }   from './connectors/gemini';
import { CoinbaseConnector } from './connectors/coinbase';
import { KrakenConnector }   from './connectors/kraken';

interface SymbolAwareConnector {
  start(): void;
  stop(): void;
  setSymbols(symbols: CryptoSymbol[]): void;
}

function emptyPriceState(symbols: CryptoSymbol[]): PriceState {
  return Object.fromEntries(
    EXCHANGES.map(ex => [
      ex,
      Object.fromEntries(symbols.map(sym => [sym, null])),
    ])
  ) as PriceState;
}

async function fetchGeminiSymbols(): Promise<Set<CryptoSymbol>> {
  const res = await fetch('https://api.gemini.com/v1/symbols', { signal: AbortSignal.timeout(8000) });
  const data: string[] = await res.json();
  const syms = new Set<CryptoSymbol>();
  for (const s of data) {
    if (!s.endsWith('usd') || s.endsWith('gusd')) continue;
    const base = s.slice(0, -3).toUpperCase();
    if (base.length >= 2 && base.length <= 10) syms.add(base);
  }
  return syms;
}

async function fetchCoinbaseSymbols(): Promise<Set<CryptoSymbol>> {
  const res = await fetch('https://api.exchange.coinbase.com/products', { signal: AbortSignal.timeout(8000) });
  const data: Array<{ id: string; status: string }> = await res.json();
  const syms = new Set<CryptoSymbol>();
  for (const p of data) {
    if (p.status !== 'online') continue;
    const m = /^([A-Z0-9]+)-USD$/.exec(p.id);
    if (m) syms.add(m[1]);
  }
  return syms;
}

async function fetchKrakenSymbols(): Promise<Set<CryptoSymbol>> {
  const res = await fetch('https://api.kraken.com/0/public/AssetPairs', { signal: AbortSignal.timeout(8000) });
  const data: { result: Record<string, { wsname?: string }> } = await res.json();
  const syms = new Set<CryptoSymbol>();
  for (const pair of Object.values(data.result)) {
    if (!pair.wsname) continue;
    const m = /^([A-Z0-9]+)\/USD$/.exec(pair.wsname);
    if (m) {
      const sym = m[1] === 'XBT' ? 'BTC' : m[1];
      syms.add(sym);
    }
  }
  return syms;
}

async function fetchPairIntersection(): Promise<CryptoSymbol[]> {
  const [gemini, coinbase, kraken] = await Promise.all([
    fetchGeminiSymbols(),
    fetchCoinbaseSymbols(),
    fetchKrakenSymbols(),
  ]);
  return [...gemini].filter(s => coinbase.has(s) && kraken.has(s)).sort();
}

class ExchangeManager extends EventEmitter {
  private symbols: CryptoSymbol[] = [...DEFAULT_SYMBOLS];
  private state: PriceState = emptyPriceState(this.symbols);
  private throttleTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private connectors: SymbolAwareConnector[] = [];

  // History buffers
  private spreadHistory: SpreadSnapshot[] = [];
  private opportunityHistory: ArbitrageOpportunity[] = [];
  private availablePairs: CryptoSymbol[] = [...PAIR_CATALOG];
  private snapshotInterval: ReturnType<typeof setInterval> | null = null;

  start() {
    const onPrice = (price: NormalizedPrice) => this.handlePrice(price);

    this.connectors = [
      new GeminiConnector(onPrice),
      new CoinbaseConnector(onPrice),
      new KrakenConnector(onPrice),
    ];
    for (const c of this.connectors) c.start();
    for (const c of this.connectors) c.setSymbols(this.symbols);

    this.snapshotInterval = setInterval(() => this.captureSpreadSnapshot(), SPREAD_SNAPSHOT_INTERVAL_MS);

    // Fetch pair intersection from exchange REST APIs; fall back to hardcoded catalog on error
    fetchPairIntersection()
      .then(pairs => {
        if (pairs.length > 0) {
          this.availablePairs = pairs;
          this.emit('catalog', pairs);
        }
      })
      .catch(() => { /* keep PAIR_CATALOG fallback */ });
  }

  private captureSpreadSnapshot() {
    const now = Date.now();
    const newSnapshots: SpreadSnapshot[] = [];

    for (const symbol of this.symbols) {
      for (const buyEx of EXCHANGES as Exchange[]) {
        for (const sellEx of EXCHANGES as Exchange[]) {
          if (buyEx === sellEx) continue;
          const buyPrice = this.state[buyEx][symbol];
          const sellPrice = this.state[sellEx][symbol];
          if (!buyPrice || !sellPrice) continue;
          if (now - buyPrice.timestamp > STALE_THRESHOLD_MS) continue;
          if (now - sellPrice.timestamp > STALE_THRESHOLD_MS) continue;

          const rawSpread = (sellPrice.bid - buyPrice.ask) / buyPrice.ask * 100;
          const netSpread = rawSpread - EXCHANGE_FEES[buyEx] * 100 - EXCHANGE_FEES[sellEx] * 100;

          newSnapshots.push({
            pair: symbol,
            exchangeBuy: buyEx,
            exchangeSell: sellEx,
            rawSpread: +rawSpread.toFixed(4),
            netSpread: +netSpread.toFixed(4),
            capturedAt: now,
          });
        }
      }
    }

    if (newSnapshots.length === 0) return;

    this.spreadHistory.push(...newSnapshots);
    if (this.spreadHistory.length > MAX_SPREAD_HISTORY) {
      this.spreadHistory = this.spreadHistory.slice(-MAX_SPREAD_HISTORY);
    }
  }

  getAvailablePairs(): CryptoSymbol[] {
    return this.availablePairs;
  }

  getSpreadHistory(pair: CryptoSymbol, sinceMs: number): SpreadSnapshot[] {
    return this.spreadHistory.filter(s => s.pair === pair && s.capturedAt >= sinceMs);
  }

  getOpportunityHistory(sinceMs: number): ArbitrageOpportunity[] {
    return this.opportunityHistory.filter(o => o.timestamp >= sinceMs);
  }

  getSymbols(): CryptoSymbol[] {
    return [...this.symbols];
  }

  addSymbol(symbol: CryptoSymbol) {
    const sym = symbol.toUpperCase();
    if (this.symbols.includes(sym)) return;
    this.symbols = [...this.symbols, sym];
    for (const ex of EXCHANGES) {
      if (!(sym in this.state[ex])) this.state[ex][sym] = null;
    }
    for (const c of this.connectors) c.setSymbols(this.symbols);
    this.emit('symbols', this.getSymbols());
  }

  removeSymbol(symbol: CryptoSymbol) {
    const sym = symbol.toUpperCase();
    if (!this.symbols.includes(sym)) return;
    this.symbols = this.symbols.filter(s => s !== sym);
    for (const ex of EXCHANGES) delete this.state[ex][sym];
    for (const c of this.connectors) c.setSymbols(this.symbols);
    this.emit('symbols', this.getSymbols());
    this.emit('opportunities', calculateArbitrage(this.state));
  }

  private handlePrice(price: NormalizedPrice) {
    if (!this.symbols.includes(price.symbol)) return;
    this.state = {
      ...this.state,
      [price.exchange]: {
        ...this.state[price.exchange as Exchange],
        [price.symbol]: price,
      },
    } as PriceState;

    this.emit('price', price);
    this.emitOpportunitiesDebounced(price.symbol);
  }

  private emitOpportunitiesDebounced(symbol: CryptoSymbol) {
    const key = symbol;
    if (this.throttleTimers.has(key)) return;

    const timer = setTimeout(() => {
      this.throttleTimers.delete(key);
      const opps = calculateArbitrage(this.state);
      if (opps.length > 0) {
        this.opportunityHistory.push(...opps);
        if (this.opportunityHistory.length > MAX_OPP_HISTORY) {
          this.opportunityHistory = this.opportunityHistory.slice(-MAX_OPP_HISTORY);
        }
      }
      this.emit('opportunities', opps);
    }, OPPORTUNITY_THROTTLE_MS);

    this.throttleTimers.set(key, timer);
  }

  getState(): PriceState {
    return this.state;
  }

  getOpportunities(): ArbitrageOpportunity[] {
    return calculateArbitrage(this.state);
  }
}

const g = globalThis as typeof globalThis & { __exchangeManager_v3?: ExchangeManager };

export function getExchangeManager(): ExchangeManager {
  if (!g.__exchangeManager_v3) {
    g.__exchangeManager_v3 = new ExchangeManager();
    g.__exchangeManager_v3.start();
  }
  return g.__exchangeManager_v3;
}
