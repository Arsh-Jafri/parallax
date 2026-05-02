export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import type { NormalizedPrice, ArbitrageOpportunity, SSEPayload, CryptoSymbol } from '@/lib/types';
import { getExchangeManager } from '@/lib/exchange-manager';
import { SSE_KEEPALIVE_MS } from '@/lib/constants';

function encode(payload: SSEPayload): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(request: Request): Promise<Response> {
  const manager = getExchangeManager();

  const stream = new ReadableStream({
    start(controller) {
      // Send current state snapshot immediately
      controller.enqueue(encode({ type: 'symbols', data: manager.getSymbols() }));
      controller.enqueue(encode({ type: 'price_snapshot', data: manager.getState() }));
      controller.enqueue(encode({ type: 'opportunities', data: manager.getOpportunities() }));

      const onPrice = (price: NormalizedPrice) => {
        try { controller.enqueue(encode({ type: 'price', data: price })); } catch { /* closed */ }
      };
      const onOpportunities = (opps: ArbitrageOpportunity[]) => {
        try { controller.enqueue(encode({ type: 'opportunities', data: opps })); } catch { /* closed */ }
      };
      const onSymbols = (syms: CryptoSymbol[]) => {
        try {
          controller.enqueue(encode({ type: 'symbols', data: syms }));
          controller.enqueue(encode({ type: 'price_snapshot', data: manager.getState() }));
        } catch { /* closed */ }
      };

      manager.on('price', onPrice);
      manager.on('opportunities', onOpportunities);
      manager.on('symbols', onSymbols);

      const keepalive = setInterval(() => {
        try { controller.enqueue(new TextEncoder().encode(': keepalive\n\n')); } catch { /* closed */ }
      }, SSE_KEEPALIVE_MS);

      request.signal.addEventListener('abort', () => {
        manager.off('price', onPrice);
        manager.off('opportunities', onOpportunities);
        manager.off('symbols', onSymbols);
        clearInterval(keepalive);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
