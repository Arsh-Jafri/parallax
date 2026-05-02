'use client';

import { usePriceStream } from '@/hooks/use-price-stream';
import { TopBar }           from '@/components/top-bar';
import { KpiGrid }          from '@/components/kpi-grid';
import { PriceCard }        from '@/components/price-card';
import { SpreadMatrix }     from '@/components/spread-matrix';
import { OpportunityLog }   from '@/components/opportunity-log';
import { PairPicker }       from '@/components/pair-picker';
import { DivergenceChart }  from '@/components/divergence-chart';
import { DivergenceLog }    from '@/components/divergence-log';
import { VolatilityTable }  from '@/components/volatility-table';
import { Footer }           from '@/components/footer';

export function PriceProvider() {
  const { symbols, prices, opportunities, connState, lastUpdated, priceHistory, chartHistory, addSymbol, removeSymbol } = usePriceStream();

  const cardColumns = symbols.length <= 1 ? '1fr' : 'repeat(auto-fit, minmax(420px, 1fr))';

  return (
    <>
      <TopBar connState={connState} lastUpdated={lastUpdated} />

      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 24px 40px' }}>
        {/* KPI row */}
        <KpiGrid prices={prices} symbols={symbols} priceHistory={priceHistory} />

        {/* Pair picker */}
        <div style={{ marginTop: 16 }}>
          <PairPicker watched={symbols} onAdd={addSymbol} onRemove={removeSymbol} />
        </div>

        {/* Live price cards */}
        <div style={{ display: 'grid', gridTemplateColumns: cardColumns, gap: 16, marginTop: 16 }}>
          {symbols.map(sym => (
            <PriceCard key={sym} symbol={sym} prices={prices} />
          ))}
        </div>

        {/* Price divergence chart — full width */}
        <div style={{ marginTop: 16 }}>
          <DivergenceChart chartHistory={chartHistory} symbols={symbols} />
        </div>

        {/* Spread matrix + divergence log */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, marginTop: 16 }}>
          <SpreadMatrix prices={prices} symbols={symbols} />
          <DivergenceLog prices={prices} symbols={symbols} />
        </div>

        {/* Pair volatility ranking — full width */}
        {symbols.length > 1 && (
          <div style={{ marginTop: 16 }}>
            <VolatilityTable prices={prices} symbols={symbols} />
          </div>
        )}

        {/* Opportunity log — only shown when real profitable opps exist */}
        {opportunities.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <OpportunityLog opportunities={opportunities} />
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
