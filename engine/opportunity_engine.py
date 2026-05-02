import asyncio
import logging
import time
from decimal import Decimal

from db import Opportunity, SessionLocal, Spread
from redis_client import get_available_pairs, get_price

logger = logging.getLogger(__name__)

EXCHANGES = ["gemini", "coinbase", "kraken"]

TAKER_FEES: dict[str, float] = {
    "gemini":   0.0040,
    "coinbase": 0.0060,
    "kraken":   0.0040,
}

MIN_PROFIT_PCT = 0.001  # 0.1%
POLL_INTERVAL = 0.15    # 150ms
STALE_MS = 5000         # 5 seconds


async def run_engine():
    logger.info("opportunity engine started (%.0fms poll interval)", POLL_INTERVAL * 1000)
    while True:
        try:
            await tick()
        except Exception as exc:
            logger.exception("engine tick error: %s", exc)
        await asyncio.sleep(POLL_INTERVAL)


async def tick():
    pairs = await get_available_pairs()
    if not pairs:
        return

    now_ms = time.time() * 1000
    spread_rows: list[dict] = []
    opp_rows: list[dict] = []

    for pair in pairs:
        # Fetch all three prices in parallel
        prices = await asyncio.gather(
            *[get_price(ex, pair) for ex in EXCHANGES],
            return_exceptions=True,
        )
        price_map: dict[str, dict] = {}
        for ex, p in zip(EXCHANGES, prices):
            if isinstance(p, Exception) or p is None:
                continue
            if now_ms - p.get("timestamp", 0) > STALE_MS:
                continue
            price_map[ex] = p

        if len(price_map) < 2:
            continue

        for buy_ex in EXCHANGES:
            for sell_ex in EXCHANGES:
                if buy_ex == sell_ex:
                    continue
                if buy_ex not in price_map or sell_ex not in price_map:
                    continue

                buy_ask = float(price_map[buy_ex]["ask"])
                sell_bid = float(price_map[sell_ex]["bid"])
                if buy_ask <= 0 or sell_bid <= 0:
                    continue

                raw_spread = (sell_bid - buy_ask) / buy_ask
                net_spread = raw_spread - TAKER_FEES[buy_ex] - TAKER_FEES[sell_ex]

                spread_rows.append({
                    "pair": pair,
                    "exchange_buy": buy_ex,
                    "exchange_sell": sell_ex,
                    "raw_spread": Decimal(str(round(raw_spread, 6))),
                    "net_spread": Decimal(str(round(net_spread, 6))),
                })

                if net_spread > MIN_PROFIT_PCT:
                    opp_rows.append({
                        "pair": pair,
                        "buy_exchange": buy_ex,
                        "sell_exchange": sell_ex,
                        "buy_price": Decimal(str(round(buy_ask, 8))),
                        "sell_price": Decimal(str(round(sell_bid, 8))),
                        "raw_spread": Decimal(str(round(raw_spread, 6))),
                        "net_spread": Decimal(str(round(net_spread, 6))),
                    })

    if not spread_rows:
        return

    async with SessionLocal() as session:
        if spread_rows:
            await session.execute(
                Spread.__table__.insert(),
                spread_rows,
            )
        if opp_rows:
            await session.execute(
                Opportunity.__table__.insert(),
                opp_rows,
            )
            logger.info("found %d opportunities this tick", len(opp_rows))
        await session.commit()
