import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from db import Opportunity, SessionLocal, Spread, create_tables
from opportunity_engine import run_engine
from redis_client import get_available_pairs, get_price

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

EXCHANGES = ["gemini", "coinbase", "kraken"]
TAKER_FEES = {"gemini": 0.0040, "coinbase": 0.0060, "kraken": 0.0040}

RANGE_HOURS = {"1H": 1, "6H": 6, "24H": 24, "7D": 168}


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    task = asyncio.create_task(run_engine())
    logger.info("parallax engine running")
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Parallax API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _dt(hours: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=hours)


def _float(v) -> float:
    if isinstance(v, Decimal):
        return float(v)
    return v


@app.get("/pairs")
async def get_pairs():
    pairs = await get_available_pairs()
    if not pairs:
        async with SessionLocal() as s:
            rows = await s.execute(select(Spread.pair).distinct())
            pairs = [r[0] for r in rows]
    return {"pairs": pairs}


@app.get("/prices")
async def get_prices(pair: str = Query(...)):
    result = {}
    for ex in EXCHANGES:
        p = await get_price(ex, pair)
        if p:
            result[ex] = {
                "bid": p["bid"],
                "ask": p["ask"],
                "timestamp": p["timestamp"],
            }
    return {"pair": pair, "prices": result}


@app.get("/spreads")
async def get_spreads(pair: str = Query(...)):
    spreads = []
    prices = {}
    for ex in EXCHANGES:
        p = await get_price(ex, pair)
        if p:
            prices[ex] = p

    for buy_ex in EXCHANGES:
        for sell_ex in EXCHANGES:
            if buy_ex == sell_ex:
                continue
            if buy_ex not in prices or sell_ex not in prices:
                continue
            buy_ask = float(prices[buy_ex]["ask"])
            sell_bid = float(prices[sell_ex]["bid"])
            if buy_ask <= 0:
                continue
            raw = (sell_bid - buy_ask) / buy_ask
            net = raw - TAKER_FEES[buy_ex] - TAKER_FEES[sell_ex]
            spreads.append({
                "buy": buy_ex,
                "sell": sell_ex,
                "rawSpread": round(raw, 6),
                "netSpread": round(net, 6),
            })
    return {"pair": pair, "spreads": spreads}


@app.get("/opportunities")
async def get_opportunities(limit: int = Query(default=50, le=500)):
    async with SessionLocal() as s:
        rows = await s.execute(
            select(Opportunity).order_by(Opportunity.detected_at.desc()).limit(limit)
        )
        opps = rows.scalars().all()
    return {
        "opportunities": [
            {
                "pair": o.pair,
                "buyExchange": o.buy_exchange,
                "sellExchange": o.sell_exchange,
                "buyPrice": _float(o.buy_price),
                "sellPrice": _float(o.sell_price),
                "rawSpread": _float(o.raw_spread),
                "netSpread": _float(o.net_spread),
                "detectedAt": o.detected_at.isoformat(),
            }
            for o in opps
        ]
    }


@app.get("/history/spreads")
async def get_history_spreads(
    pair: str = Query(...),
    range: str = Query(default="1H"),
):
    hours = RANGE_HOURS.get(range, 1)
    since = _dt(hours)
    async with SessionLocal() as s:
        rows = await s.execute(
            select(Spread)
            .where(Spread.pair == pair, Spread.captured_at >= since)
            .order_by(Spread.captured_at.asc())
        )
        snaps = rows.scalars().all()
    return {
        "pair": pair,
        "range": range,
        "data": [
            {
                "exchangeBuy": s.exchange_buy,
                "exchangeSell": s.exchange_sell,
                "rawSpread": _float(s.raw_spread),
                "netSpread": _float(s.net_spread),
                "capturedAt": s.captured_at.isoformat(),
            }
            for s in snaps
        ],
    }


@app.get("/history/opportunities")
async def get_history_opportunities(range: str = Query(default="24H")):
    hours = RANGE_HOURS.get(range, 24)
    since = _dt(hours)
    async with SessionLocal() as s:
        rows = await s.execute(
            select(Opportunity)
            .where(Opportunity.detected_at >= since)
            .order_by(Opportunity.detected_at.desc())
        )
        opps = rows.scalars().all()
    return {
        "range": range,
        "data": [
            {
                "pair": o.pair,
                "buyExchange": o.buy_exchange,
                "sellExchange": o.sell_exchange,
                "buyPrice": _float(o.buy_price),
                "sellPrice": _float(o.sell_price),
                "rawSpread": _float(o.raw_spread),
                "netSpread": _float(o.net_spread),
                "detectedAt": o.detected_at.isoformat(),
            }
            for o in opps
        ],
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
