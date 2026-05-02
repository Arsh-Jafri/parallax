export type Exchange = 'gemini' | 'coinbase' | 'kraken';
export type CryptoSymbol = string;

export interface NormalizedPrice {
  exchange: Exchange;
  symbol: CryptoSymbol;
  bid: number;
  ask: number;
  timestamp: number;
}

export type PriceState = Record<Exchange, Record<CryptoSymbol, NormalizedPrice | null>>;

export interface ArbitrageOpportunity {
  symbol: CryptoSymbol;
  buyExchange: Exchange;
  sellExchange: Exchange;
  buyAsk: number;
  sellBid: number;
  grossSpread: number;
  netProfit: number;
  profitPct: number;
  timestamp: number;
}

export interface ConnectionStatus {
  exchange: Exchange;
  connected: boolean;
  lastSeen: number;
}

export type SSEPayload =
  | { type: 'price_snapshot'; data: PriceState }
  | { type: 'price'; data: NormalizedPrice }
  | { type: 'opportunities'; data: ArbitrageOpportunity[] }
  | { type: 'connection'; data: ConnectionStatus }
  | { type: 'symbols'; data: CryptoSymbol[] };
