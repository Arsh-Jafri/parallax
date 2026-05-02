export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getExchangeManager } from '@/lib/exchange-manager';
import { fastapiEnabled } from '@/lib/fastapi-proxy';

const FASTAPI_URL = process.env.FASTAPI_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';

export async function GET(): Promise<Response> {
  if (fastapiEnabled()) {
    const res = await fetch(`${FASTAPI_URL}/pairs`, { next: { revalidate: 0 } });
    const d = await res.json() as { pairs: string[] };
    return Response.json({ watched: d.pairs ?? [], catalog: d.pairs ?? [] });
  }
  const manager = getExchangeManager();
  return Response.json({
    watched: manager.getSymbols(),
    catalog: manager.getAvailablePairs(),
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
