export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getExchangeManager } from '@/lib/exchange-manager';
import { PAIR_CATALOG } from '@/lib/constants';

export async function GET(): Promise<Response> {
  const manager = getExchangeManager();
  return Response.json({
    watched: manager.getSymbols(),
    catalog: PAIR_CATALOG,
  });
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null) as { symbol?: string } | null;
  const symbol = body?.symbol?.trim().toUpperCase();
  if (!symbol || !/^[A-Z0-9]{2,10}$/.test(symbol)) {
    return Response.json({ error: 'invalid symbol' }, { status: 400 });
  }
  getExchangeManager().addSymbol(symbol);
  return Response.json({ ok: true, watched: getExchangeManager().getSymbols() });
}

export async function DELETE(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol')?.trim().toUpperCase();
  if (!symbol) return Response.json({ error: 'missing symbol' }, { status: 400 });
  getExchangeManager().removeSymbol(symbol);
  return Response.json({ ok: true, watched: getExchangeManager().getSymbols() });
}
