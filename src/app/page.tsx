import { PriceProvider } from '@/components/providers/price-provider';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>
      <PriceProvider />
    </div>
  );
}
