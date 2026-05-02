'use client';

import { usePriceStream } from '@/hooks/use-price-stream';
import { TopBar }         from '@/components/top-bar';
import { KpiGrid }        from '@/components/kpi-grid';
import { PriceCard }      from '@/components/price-card';
import { SpreadMatrix }   from '@/components/spread-matrix';
import { OpportunityLog } from '@/components/opportunity-log';
import { PairPicker }     from '@/components/pair-picker';

export function PriceProvider() {
  const { symbols, prices, opportunities, connState, lastUpdated, priceHistory, addSymbol, removeSymbol } = usePriceStream();

  // Two-column responsive grid for price cards. Many symbols stack into rows.
  const cardColumns = symbols.length <= 1 ? '1fr' : 'repeat(auto-fit, minmax(420px, 1fr))';

  return (
    <>
      <TopBar connState={connState} lastUpdated={lastUpdated} />

      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 24px 80px' }}>
        {/* KPI row */}
        <KpiGrid prices={prices} opportunities={opportunities} symbols={symbols} priceHistory={priceHistory} />

        {/* Pair picker */}
        <div style={{ marginTop: 16 }}>
          <PairPicker watched={symbols} onAdd={addSymbol} onRemove={removeSymbol} />
        </div>

        {/* Live prices grid */}
        <div style={{ display: 'grid', gridTemplateColumns: cardColumns, gap: 16, marginTop: 16 }}>
          {symbols.map(sym => (
            <PriceCard key={sym} symbol={sym} prices={prices} />
          ))}
        </div>

        {/* Bottom: matrix + opportunity log */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, marginTop: 16 }}>
          <SpreadMatrix prices={prices} symbols={symbols} />
          <OpportunityLog opportunities={opportunities} />
        </div>
      </div>
    </>
  );
}
