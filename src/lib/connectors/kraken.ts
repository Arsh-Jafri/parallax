import WebSocket from 'ws';
import type { NormalizedPrice, CryptoSymbol } from '../types';
import { RECONNECT_BASE_MS, RECONNECT_MAX_MS, RECONNECT_FACTOR } from '../constants';

// Kraken uses 'XBT' for Bitcoin, but their v2 ticker accepts 'BTC/USD' too.
// We map our internal symbol → Kraken's pair string.
function toKrakenPair(symbol: CryptoSymbol): string { return `${symbol}/USD`; }
function fromKrakenPair(pair: string): CryptoSymbol | null {
  const m = /^([A-Z0-9]+)\/USD$/.exec(pair);
  return m ? m[1] : null;
}

export class KrakenConnector {
  private ws: WebSocket | null = null;
  private reconnectDelay = RECONNECT_BASE_MS;
  private wanted = new Set<CryptoSymbol>();

  constructor(private onPrice: (price: NormalizedPrice) => void) {}

  start() {
    this.connect();
  }

  setSymbols(symbols: CryptoSymbol[]) {
    const next = new Set(symbols);
    for (const sym of next) if (!this.wanted.has(sym)) this.subscribe(sym);
    for (const sym of this.wanted) if (!next.has(sym)) this.unsubscribe(sym);
  }

  subscribe(symbol: CryptoSymbol) {
    if (this.wanted.has(symbol)) return;
    this.wanted.add(symbol);
    this.send({ method: 'subscribe', params: { channel: 'ticker', symbol: [toKrakenPair(symbol)] } });
  }

  unsubscribe(symbol: CryptoSymbol) {
    if (!this.wanted.has(symbol)) return;
    this.wanted.delete(symbol);
    this.send({ method: 'unsubscribe', params: { channel: 'ticker', symbol: [toKrakenPair(symbol)] } });
  }

  private send(msg: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private connect() {
    const ws = new WebSocket('wss://ws.kraken.com/v2');
    this.ws = ws;

    ws.on('open', () => {
      if (this.wanted.size === 0) return;
      ws.send(JSON.stringify({
        method: 'subscribe',
        params: {
          channel: 'ticker',
          symbol: [...this.wanted].map(toKrakenPair),
        },
      }));
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.channel !== 'ticker') return;
        if (msg.type !== 'snapshot' && msg.type !== 'update') return;
        if (!Array.isArray(msg.data)) return;

        for (const entry of msg.data) {
          const symbol = fromKrakenPair(entry.symbol);
          if (!symbol || !this.wanted.has(symbol)) continue;

          const bid = entry.bid;
          const ask = entry.ask;
          if (typeof bid !== 'number' || typeof ask !== 'number') continue;
          if (bid <= 0 || ask <= 0) continue;

          this.reconnectDelay = RECONNECT_BASE_MS;
          this.onPrice({ exchange: 'kraken', symbol, bid, ask, timestamp: Date.now() });
        }
      } catch {
        // discard parse errors
      }
    });

    ws.on('close', () => this.scheduleReconnect());
    ws.on('error', () => ws.terminate());
  }

  private scheduleReconnect() {
    const jitter = Math.random() * 1000;
    setTimeout(() => this.connect(), this.reconnectDelay + jitter);
    this.reconnectDelay = Math.min(this.reconnectDelay * RECONNECT_FACTOR, RECONNECT_MAX_MS);
  }

  stop() {
    this.wanted.clear();
    this.ws?.terminate();
    this.ws = null;
  }
}
