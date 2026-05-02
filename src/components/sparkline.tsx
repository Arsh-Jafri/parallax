interface SparklineProps {
  data: number[];
  tone?: 'profit' | 'loss' | 'accent';
  height?: number;
}

function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return '';
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[Math.max(0, i - 1)];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = points[Math.min(points.length - 1, i + 2)];
    const cp1x = x1 + (x2 - x0) / 6;
    const cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6;
    const cp2y = y2 - (y3 - y1) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`;
  }
  return d;
}

export function Sparkline({ data, tone = 'accent', height = 32 }: SparklineProps) {
  const VW = 1000; // virtual viewport width — SVG scales to fill container
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const step = VW / (data.length - 1);
  const points: [number, number][] = data.map((v, i) => [
    i * step,
    height - ((v - min) / range) * (height - 2) - 1,
  ]);
  const linePath = smoothPath(points);
  const colorVar =
    tone === 'profit' ? 'var(--profit)' :
    tone === 'loss'   ? 'var(--loss)'   : 'var(--accent-color)';
  const gradId = `spark-${tone}-${Math.abs(data[0] * 1000).toFixed(0)}`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${VW} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor={colorVar} stopOpacity="0.28" />
          <stop offset="100%" stopColor={colorVar} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path
        d={`${linePath} L${VW},${height} L0,${height} Z`}
        fill={`url(#${gradId})`}
      />
      <path
        d={linePath}
        fill="none"
        stroke={colorVar}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
