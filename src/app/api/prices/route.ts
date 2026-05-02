export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getExchangeManager } from '@/lib/exchange-manager';
import { EXCHANGES } from '@/lib/constants';
import { fastapiEnabled } from '@/lib/fastapi-proxy';

const FASTAPI_URL = process.env.FASTAPI_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const pair = searchParams.get('pair')?.trim().toUpperCase();
  if (!pair) return Response.json({ error: 'missing pair parameter' }, { status: 400 });

  if (fastapiEnabled()) {
    const res = await fetch(`${FASTAPI_URL}/prices?pair=${pair}`, { next: { revalidate: 0 } });
    const d = await res.json() as { prices: Record<string, { bid: number; ask: number; timestamp: number }> };
    const prices = EXCHANGES.map(ex => {
      const p = d.prices?.[ex];
      return p ? { exchange: ex, pair, bid: p.bid, ask: p.ask, timestamp: p.timestamp } : { exchange: ex, pair, bid: null, ask: null, timestamp: null };
    });
    return Response.json(prices);
  }

  const state = getExchangeManager().getState();
  const prices = EXCHANGES.map(exchange => {
    const p = state[exchange]?.[pair] ?? null;
    if (!p) return { exchange, pair, bid: null, ask: null, timestamp: null };
    return { exchange, pair, bid: p.bid, ask: p.ask, timestamp: p.timestamp };
  });
  return Response.json(prices);
}
