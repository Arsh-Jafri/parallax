import Image from 'next/image';

const TOKEN = 'pk_RYtf5ZLaSLKUwatT_a06ng';

interface CryptoIconProps {
  symbol: string;
  size?: number;
}

export function CryptoIcon({ symbol, size = 24 }: CryptoIconProps) {
  return (
    <Image
      src={`https://img.logo.dev/crypto/${symbol.toLowerCase()}?token=${TOKEN}`}
      alt={symbol}
      width={size}
      height={size}
      style={{ borderRadius: '50%', display: 'block', flexShrink: 0 }}
    />
  );
}
