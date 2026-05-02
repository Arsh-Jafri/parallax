CREATE TABLE IF NOT EXISTS spreads (
  id SERIAL PRIMARY KEY,
  pair VARCHAR(20) NOT NULL,
  exchange_buy VARCHAR(20) NOT NULL,
  exchange_sell VARCHAR(20) NOT NULL,
  raw_spread DECIMAL(10, 6) NOT NULL,
  net_spread DECIMAL(10, 6) NOT NULL,
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunities (
  id SERIAL PRIMARY KEY,
  pair VARCHAR(20) NOT NULL,
  buy_exchange VARCHAR(20) NOT NULL,
  sell_exchange VARCHAR(20) NOT NULL,
  buy_price DECIMAL(20, 8) NOT NULL,
  sell_price DECIMAL(20, 8) NOT NULL,
  raw_spread DECIMAL(10, 6) NOT NULL,
  net_spread DECIMAL(10, 6) NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spreads_pair_time ON spreads (pair, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_pair_time ON opportunities (pair, detected_at DESC);
