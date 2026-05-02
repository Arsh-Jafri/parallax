import WebSocket from 'ws';
import type { NormalizedPrice, CryptoSymbol } from '../types';
import { RECONNECT_BASE_MS, RECONNECT_MAX_MS, RECONNECT_FACTOR } from '../constants';

function toProductId(symbol: CryptoSymbol): string { return `${symbol}-USD`; }
function fromProductId(id: string): CryptoSymbol | null {
  const m = /^([A-Z0-9]+)-USD$/.exec(id);
  return m ? m[1] : null;
}

export class CoinbaseConnector {
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
    this.send({ type: 'subscribe', product_ids: [toProductId(symbol)], channel: 'ticker' });
  }

  unsubscribe(symbol: CryptoSymbol) {
    if (!this.wanted.has(symbol)) return;
    this.wanted.delete(symbol);
    this.send({ type: 'unsubscribe', product_ids: [toProductId(symbol)], channel: 'ticker' });
  }

  private send(msg: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private connect() {
    const ws = new WebSocket('wss://advanced-trade-ws.coinbase.com');
    this.ws = ws;

    ws.on('open', () => {
      if (this.wanted.size === 0) return;
      ws.send(JSON.stringify({
        type: 'subscribe',
        product_ids: [...this.wanted].map(toProductId),
        channel: 'ticker',
      }));
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.channel !== 'ticker' || !Array.isArray(msg.events)) return;

        for (const event of msg.events) {
          if (!Array.isArray(event.tickers)) continue;
          for (const ticker of event.tickers) {
            const symbol = fromProductId(ticker.product_id);
            if (!symbol || !this.wanted.has(symbol)) continue;

            const bid = parseFloat(ticker.best_bid);
            const ask = parseFloat(ticker.best_ask);
            if (isNaN(bid) || isNaN(ask) || bid <= 0 || ask <= 0) continue;

            this.reconnectDelay = RECONNECT_BASE_MS;
            const timestamp = msg.timestamp ? Date.parse(msg.timestamp) : Date.now();
            this.onPrice({ exchange: 'coinbase', symbol, bid, ask, timestamp });
          }
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
