import { EventEmitter } from 'events';
import type { NormalizedPrice, PriceState, ArbitrageOpportunity, Exchange, CryptoSymbol } from './types';
import { EXCHANGES, DEFAULT_SYMBOLS, OPPORTUNITY_THROTTLE_MS } from './constants';
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

class ExchangeManager extends EventEmitter {
  private symbols: CryptoSymbol[] = [...DEFAULT_SYMBOLS];
  private state: PriceState = emptyPriceState(this.symbols);
  private throttleTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private connectors: SymbolAwareConnector[] = [];

  start() {
    const onPrice = (price: NormalizedPrice) => this.handlePrice(price);

    this.connectors = [
      new GeminiConnector(onPrice),
      new CoinbaseConnector(onPrice),
      new KrakenConnector(onPrice),
    ];
    for (const c of this.connectors) c.start();
    for (const c of this.connectors) c.setSymbols(this.symbols);
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

const g = globalThis as typeof globalThis & { __exchangeManager_v2?: ExchangeManager };

export function getExchangeManager(): ExchangeManager {
  if (!g.__exchangeManager_v2) {
    g.__exchangeManager_v2 = new ExchangeManager();
    g.__exchangeManager_v2.start();
  }
  return g.__exchangeManager_v2;
}
