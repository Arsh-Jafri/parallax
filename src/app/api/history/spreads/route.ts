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
  const pair  = searchParams.get('pair')?.trim().toUpperCase();
  const range = (searchParams.get('range') ?? '1H').toUpperCase();

  if (!pair) return Response.json({ error: 'missing pair parameter' }, { status: 400 });

  if (fastapiEnabled()) {
    const res = await fetch(`${FASTAPI_URL}/history/spreads?pair=${pair}&range=${range}`, { next: { revalidate: 0 } });
    const d = await res.json() as { data: Array<{ exchangeBuy: string; exchangeSell: string; rawSpread: number; netSpread: number; capturedAt: string }> };
    // Normalize: FastAPI stores spreads as fractions (0.0012); frontend expects percentages (0.12)
    const data = (d.data ?? []).map(s => ({
      pair,
      exchangeBuy: s.exchangeBuy,
      exchangeSell: s.exchangeSell,
      rawSpread: +(s.rawSpread * 100).toFixed(4),
      netSpread: +(s.netSpread * 100).toFixed(4),
      capturedAt: new Date(s.capturedAt).getTime(),
    }));
    return Response.json({ pair, range, data });
  }

  const windowMs = RANGE_MS[range] ?? RANGE_MS['1H'];
  const sinceMs  = Date.now() - windowMs;
  const data     = getExchangeManager().getSpreadHistory(pair, sinceMs);
  return Response.json({ pair, range, data });
}
