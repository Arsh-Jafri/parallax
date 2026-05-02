export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getExchangeManager } from '@/lib/exchange-manager';
import { fastapiEnabled } from '@/lib/fastapi-proxy';

const FASTAPI_URL = process.env.FASTAPI_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';

const RANGE_MS: Record<string, number> = {
  '1H':  1 * 60 * 60 * 1000,
  '6H':  6 * 60 * 60 * 1000,
  '24H': 24 * 60 * 60 * 1000,
  '7D':  7 * 24 * 60 * 60 * 1000,
};

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const range   = (searchParams.get('range') ?? '1H').toUpperCase();

  if (fastapiEnabled()) {
    const res = await fetch(`${FASTAPI_URL}/history/opportunities?range=${range}`, { next: { revalidate: 0 } });
    const d = await res.json() as {
      data: Array<{
        pair: string; buyExchange: string; sellExchange: string;
        buyPrice: number; sellPrice: number; rawSpread: number; netSpread: number; detectedAt: string;
      }>;
    };
    // Normalize to ArbitrageOpportunity shape; FastAPI uses fractional spreads, frontend uses %
    const data = (d.data ?? []).map(o => ({
      symbol:      o.pair,
      buyExchange: o.buyExchange,
      sellExchange: o.sellExchange,
      buyAsk:      o.buyPrice,
      sellBid:     o.sellPrice,
      grossSpread: o.sellPrice - o.buyPrice,
      netProfit:   o.netSpread * o.buyPrice,
      profitPct:   +(o.netSpread * 100).toFixed(4),
      timestamp:   new Date(o.detectedAt).getTime(),
    }));
    return Response.json({ range, data });
  }

  const windowMs = RANGE_MS[range] ?? RANGE_MS['1H'];
  const sinceMs  = Date.now() - windowMs;
  const data     = getExchangeManager().getOpportunityHistory(sinceMs);
  return Response.json({ range, data });
}
