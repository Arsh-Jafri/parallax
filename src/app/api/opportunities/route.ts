export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getExchangeManager } from '@/lib/exchange-manager';

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 500) : 50;

  const opportunities = getExchangeManager().getOpportunities().slice(0, limit);
  return Response.json(opportunities);
}
