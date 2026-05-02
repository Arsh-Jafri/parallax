import type { Exchange, CryptoSymbol } from './types';

// Maker fees (post-only / resting orders). Lower than taker — realistic if you
// market-make. Real tiers depend on 30d volume; these are public defaults.
export const EXCHANGE_FEES: Record<Exchange, number> = {
  gemini:   0.0020,
  coinbase: 0.0040,
  kraken:   0.0016,
};

export const EXCHANGES: Exchange[]    = ['gemini', 'coinbase', 'kraken'];

// Default pairs the dashboard boots with. User can add more from the catalog.
export const DEFAULT_SYMBOLS: CryptoSymbol[] = ['BTC', 'ETH'];
export const SYMBOLS: CryptoSymbol[] = DEFAULT_SYMBOLS;

// Pairs supported across all 3 exchanges (USD quoted). Used by the picker.
export const PAIR_CATALOG: CryptoSymbol[] = [
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'LINK', 'AVAX',
  'DOT', 'LTC', 'BCH', 'UNI', 'ATOM', 'FIL', 'AAVE', 'MKR',
  'COMP', 'GRT', 'SAND', 'MANA', 'SHIB', 'ALGO', 'XLM', 'XTZ',
  'CRV', 'SNX', 'YFI', 'BAT', 'ZRX', 'ENJ',
];

export const STALE_THRESHOLD_MS  = 30_000;
export const MIN_PROFIT_PCT      = 0.01;

export const RECONNECT_BASE_MS   = 1_000;
export const RECONNECT_MAX_MS    = 30_000;
export const RECONNECT_FACTOR    = 2;

export const OPPORTUNITY_THROTTLE_MS = 500;
export const SSE_KEEPALIVE_MS        = 15_000;
