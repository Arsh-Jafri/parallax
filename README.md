<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)"  srcset="public/white-text-logo.png?v=2">
  <source media="(prefers-color-scheme: light)" srcset="public/black-text-logo.png?v=2">
  <img alt="Parallax" src="public/black-text-logo.png?v=2" height="60">
</picture>
</div>

Real-time crypto arbitrage monitor. Ingests live WebSocket price feeds from Gemini, Coinbase, and Kraken, computes fee-adjusted spreads across every available trading pair, and surfaces opportunities through a live dashboard backed by a Go/Python data pipeline.

<img src="public/preview.png?v=2" alt="Parallax dashboard preview" style="border-radius: 12px; width: 100%;" />

---

## Architecture

```
[Gemini WS] ──┐
[Coinbase WS] ─┼──► Go Ingestion ──► Redis (live prices) ──► Python Engine ──► PostgreSQL (history)
[Kraken WS] ──┘                                                      │
                                                                      ▼
                                                              FastAPI REST API
                                                                      │
                                                                      ▼
                                                            Next.js Dashboard
```

---

## Stack

| Layer | Technology |
|---|---|
| WebSocket ingestion | Go + gorilla/websocket |
| Opportunity engine | Python + asyncio |
| REST API | Python / FastAPI |
| Frontend | Next.js 15 + Recharts |
| Cache | Redis |
| Database | PostgreSQL |
| Containerization | Docker Compose |

---

## Services

### Go Ingestion (`/ingestion`)

- Fetches available trading pairs from each exchange's REST API on startup and computes the intersection
- Spawns one goroutine per exchange maintaining a persistent WebSocket connection
- Normalizes all ticks to a common schema and writes to Redis at `price:{exchange}:{pair}` with a 5s TTL
- Exponential backoff reconnection on disconnect

**Exchange feeds:**
- Gemini — L2 order book (`wss://api.gemini.com/v1/marketdata/{symbol}`)
- Coinbase — Advanced Trade ticker (`wss://advanced-trade-ws.coinbase.com`)
- Kraken — Ticker (`wss://ws.kraken.com`)

### Python Engine (`/engine`)

- Polls Redis every 150ms for all tracked pairs
- Computes spreads across all 6 directional exchange combinations
- Applies fee-adjusted filter: `net_spread = raw_spread − fee_buy − fee_sell`
- Persists every spread snapshot to PostgreSQL `spreads` table
- Persists profitable opportunities (net > 0.1%) to `opportunities` table

**Taker fees:** Gemini 0.40% · Coinbase 0.60% · Kraken 0.40%

### FastAPI (`/engine/main.py`)

| Endpoint | Description |
|---|---|
| `GET /pairs` | Tradeable pairs available across all exchanges |
| `GET /prices` | Latest prices per exchange for a given pair |
| `GET /spreads` | Current spread data for a given pair |
| `GET /opportunities` | Recent profitable opportunities |
| `GET /history/spreads` | Spread history with time range (1H/6H/24H/7D) |
| `GET /history/opportunities` | Opportunity log with time range |

### Next.js Dashboard (`/src`)

**Live** — real-time price cards per exchange, spread matrix, price divergence chart, exchange gap log

**History** — spread-over-time line chart per pair and time range, opportunity log table

**Stats** — total opportunity count, avg profit, best route, opportunities-by-hour bar chart, top routes ranked by occurrence

---

## Running Locally

### Full stack (Docker)

```bash
docker compose up --build
```

Services start on:
- Frontend: `http://localhost:3000`
- FastAPI: `http://localhost:8000`
- Redis: `localhost:6379`
- PostgreSQL: `localhost:5432`

### Frontend only (no Docker)

The Next.js app runs standalone with an in-memory exchange manager when `FASTAPI_URL` is not set.

```bash
npm install
npm run dev -- -p 3333
```

Open `http://localhost:3333`.

### Connecting to the full backend

Create `.env.local`:

```
FASTAPI_URL=http://localhost:8000
```

The Next.js API routes automatically proxy to FastAPI when this variable is set.

---

## PostgreSQL Schema

```sql
CREATE TABLE spreads (
  id           SERIAL PRIMARY KEY,
  pair         VARCHAR(20)    NOT NULL,
  exchange_buy VARCHAR(20)    NOT NULL,
  exchange_sell VARCHAR(20)   NOT NULL,
  raw_spread   DECIMAL(10,6)  NOT NULL,
  net_spread   DECIMAL(10,6)  NOT NULL,
  captured_at  TIMESTAMPTZ    DEFAULT NOW()
);

CREATE TABLE opportunities (
  id            SERIAL PRIMARY KEY,
  pair          VARCHAR(20)    NOT NULL,
  buy_exchange  VARCHAR(20)    NOT NULL,
  sell_exchange VARCHAR(20)    NOT NULL,
  buy_price     DECIMAL(20,8)  NOT NULL,
  sell_price    DECIMAL(20,8)  NOT NULL,
  raw_spread    DECIMAL(10,6)  NOT NULL,
  net_spread    DECIMAL(10,6)  NOT NULL,
  detected_at   TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX idx_spreads_pair_time       ON spreads       (pair, captured_at DESC);
CREATE INDEX idx_opportunities_pair_time ON opportunities (pair, detected_at DESC);
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `FASTAPI_URL` | *(unset)* | FastAPI base URL — enables DB-backed mode |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string (ingestion + engine) |
| `DATABASE_URL` | `postgresql+asyncpg://...` | PostgreSQL connection string (engine) |

---

## Out of Scope (V1)

- Trade execution
- User authentication
- Email/SMS alerts
- Mobile responsiveness
- More than 3 exchanges
- Order book depth analysis
