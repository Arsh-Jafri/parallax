// Shared Recharts style constants
export const FONT = 'var(--font-sans)';
export const FG3  = 'var(--fg-tertiary)';
export const FG2  = 'var(--fg-secondary)';
export const GRID = 'var(--grid-line)';

export const axisProps = {
  axisLine:  false,
  tickLine:  false,
  tick: { fontSize: 11, fill: FG3, fontFamily: FONT },
} as const;

export const gridProps = {
  stroke:          GRID,
  strokeDasharray: '',          // solid, very faint
  vertical:        false,
} as const;

export const tooltipStyle = {
  background:   'var(--bg-raised)',
  border:       '1px solid var(--border-subtle)',
  borderRadius: 10,
  fontSize:     12,
  fontFamily:   FONT,
  boxShadow:    '0 4px 16px rgba(0,0,0,0.3)',
  padding:      '8px 12px',
} as const;

export const tooltipCursor = { stroke: 'var(--border-default)', strokeWidth: 1 };

// Exchange line colors — brand-adjacent, muted
export const EX_COLORS = {
  gemini:   '#c47a3a',   // orange
  coinbase: '#4a7ab5',   // blue
  kraken:   '#7c5ea8',   // purple
} as const;
