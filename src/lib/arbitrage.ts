import type { PriceState, ArbitrageOpportunity, Exchange } from './types';
import { EXCHANGE_FEES, EXCHANGES, STALE_THRESHOLD_MS, MIN_PROFIT_PCT } from './constants';

export function calculateArbitrage(state: PriceState): ArbitrageOpportunity[] {
  const now = Date.now();
  const opportunities: ArbitrageOpportunity[] = [];

  // Symbols can vary across exchanges as they're added/removed; union all keys.
  const symbols = new Set<string>();
  for (const ex of EXCHANGES) for (const k of Object.keys(state[ex] ?? {})) symbols.add(k);

  for (const symbol of symbols) {
    for (const buyExchange of EXCHANGES as Exchange[]) {
      for (const sellExchange of EXCHANGES as Exchange[]) {
        if (buyExchange === sellExchange) continue;

        const buyPrice  = state[buyExchange][symbol];
        const sellPrice = state[sellExchange][symbol];

        if (!buyPrice || !sellPrice) continue;
        if (now - buyPrice.timestamp  > STALE_THRESHOLD_MS) continue;
        if (now - sellPrice.timestamp > STALE_THRESHOLD_MS) continue;

        const { ask: buyAsk } = buyPrice;
        const { bid: sellBid } = sellPrice;

        const cost    = buyAsk  * (1 + EXCHANGE_FEES[buyExchange]);
        const revenue = sellBid * (1 - EXCHANGE_FEES[sellExchange]);
        const netProfit   = revenue - cost;
        const profitPct   = (netProfit / cost) * 100;

        if (profitPct < MIN_PROFIT_PCT) continue;

        opportunities.push({
          symbol,
          buyExchange,
          sellExchange,
          buyAsk,
          sellBid,
          grossSpread: sellBid - buyAsk,
          netProfit,
          profitPct,
          timestamp: now,
        });
      }
    }
  }

  return opportunities.sort((a, b) => b.profitPct - a.profitPct);
}
