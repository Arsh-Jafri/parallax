export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getExchangeManager } from '@/lib/exchange-manager';
import { EXCHANGES, EXCHANGE_FEES, STALE_THRESHOLD_MS } from '@/lib/constants';
import type { Exchange } from '@/lib/types';

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const pair = searchParams.get('pair')?.trim().toUpperCase();
  if (!pair) return Response.json({ error: 'missing pair parameter' }, { status: 400 });

  const state = getExchangeManager().getState();
  const now = Date.now();
  const spreads = [];

  for (const buyEx of EXCHANGES as Exchange[]) {
    for (const sellEx of EXCHANGES as Exchange[]) {
      if (buyEx === sellEx) continue;
      const buyPrice = state[buyEx]?.[pair];
      const sellPrice = state[sellEx]?.[pair];
      if (!buyPrice || !sellPrice) continue;
      if (now - buyPrice.timestamp > STALE_THRESHOLD_MS) continue;
      if (now - sellPrice.timestamp > STALE_THRESHOLD_MS) continue;

      const rawSpread = (sellPrice.bid - buyPrice.ask) / buyPrice.ask * 100;
      const netSpread = rawSpread - EXCHANGE_FEES[buyEx] * 100 - EXCHANGE_FEES[sellEx] * 100;

      spreads.push({
        pair,
        exchangeBuy: buyEx,
        exchangeSell: sellEx,
        buyAsk: buyPrice.ask,
        sellBid: sellPrice.bid,
        rawSpread: +rawSpread.toFixed(4),
        netSpread: +netSpread.toFixed(4),
      });
    }
  }

  return Response.json(spreads);
}
