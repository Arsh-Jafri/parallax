import WebSocket from 'ws';
import type { NormalizedPrice, CryptoSymbol } from '../types';
import { RECONNECT_BASE_MS, RECONNECT_MAX_MS, RECONNECT_FACTOR } from '../constants';

export class GeminiConnector {
  private connections = new Map<CryptoSymbol, WebSocket>();
  private reconnectDelays = new Map<CryptoSymbol, number>();
  private wanted = new Set<CryptoSymbol>();

  constructor(private onPrice: (price: NormalizedPrice) => void) {}

  setSymbols(symbols: CryptoSymbol[]) {
    const next = new Set(symbols);
    for (const sym of next) if (!this.wanted.has(sym)) this.subscribe(sym);
    for (const sym of this.wanted) if (!next.has(sym)) this.unsubscribe(sym);
    this.wanted = next;
  }

  subscribe(symbol: CryptoSymbol) {
    this.wanted.add(symbol);
    if (this.connections.has(symbol)) return;
    this.reconnectDelays.set(symbol, RECONNECT_BASE_MS);
    this.connect(symbol);
  }

  unsubscribe(symbol: CryptoSymbol) {
    this.wanted.delete(symbol);
    const ws = this.connections.get(symbol);
    if (ws) {
      ws.removeAllListeners('close');
      ws.terminate();
      this.connections.delete(symbol);
    }
    this.reconnectDelays.delete(symbol);
  }

  private connect(symbol: CryptoSymbol) {
    const wsSymbol = `${symbol}USD`;
    const ws = new WebSocket(`wss://api.gemini.com/v1/marketdata/${wsSymbol}?top_of_book=true`);
    this.connections.set(symbol, ws);

    let bid: number | null = null;
    let ask: number | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type !== 'update' || !Array.isArray(msg.events)) return;

        let changed = false;
        for (const event of msg.events) {
          if (event.type !== 'change') continue;
          if (event.reason !== 'top-of-book' && event.reason !== 'initial') continue;
          const price = parseFloat(event.price);
          const remaining = parseFloat(event.remaining);
          if (isNaN(price) || remaining === 0) continue;

          if (event.side === 'bid') { bid = price; changed = true; }
          if (event.side === 'ask') { ask = price; changed = true; }
        }

        if (changed && bid !== null && ask !== null) {
          this.reconnectDelays.set(symbol, RECONNECT_BASE_MS);
          this.onPrice({ exchange: 'gemini', symbol, bid, ask, timestamp: Date.now() });
        }
      } catch {
        // discard parse errors
      }
    });

    ws.on('close', () => {
      this.connections.delete(symbol);
      if (this.wanted.has(symbol)) this.scheduleReconnect(symbol);
    });
    ws.on('error', () => ws.terminate());
  }

  private scheduleReconnect(symbol: CryptoSymbol) {
    const delay = this.reconnectDelays.get(symbol) ?? RECONNECT_BASE_MS;
    const jitter = Math.random() * 1000;
    setTimeout(() => {
      if (this.wanted.has(symbol)) this.connect(symbol);
    }, delay + jitter);
    this.reconnectDelays.set(
      symbol,
      Math.min(delay * RECONNECT_FACTOR, RECONNECT_MAX_MS)
    );
  }

  start() {
    // no-op; subscribe drives connection
  }

  stop() {
    this.wanted.clear();
    for (const ws of this.connections.values()) ws.terminate();
    this.connections.clear();
  }
}
