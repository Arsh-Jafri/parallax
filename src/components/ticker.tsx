'use client';

import { useRef, useEffect } from 'react';

interface TickerProps {
  value: number;
  size?: 'xl' | 'lg' | 'md' | 'sm';
  decimals?: number;
  currency?: string;
}

export function Ticker({ value, size = 'lg', decimals = 2, currency = '$' }: TickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);

  useEffect(() => {
    if (!ref.current) return;
    if (value > prev.current) {
      ref.current.classList.add('flash-up');
    } else if (value < prev.current) {
      ref.current.classList.add('flash-down');
    }
    const t = setTimeout(() => {
      ref.current?.classList.remove('flash-up', 'flash-down');
    }, 700);
    prev.current = value;
    return () => clearTimeout(t);
  }, [value]);

  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const [intPart, decPart] = formatted.split('.');

  return (
    <span ref={ref} className={`ticker ticker--${size}`}>
      <span className="currency">{currency}</span>
      {intPart}
      {decPart && <span className="decimals">.{decPart}</span>}
    </span>
  );
}
