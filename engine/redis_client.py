import json
import os
from typing import Optional

import redis.asyncio as aioredis

_client: Optional[aioredis.Redis] = None


def get_client() -> aioredis.Redis:
    global _client
    if _client is None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379")
        _client = aioredis.from_url(url, decode_responses=True)
    return _client


async def get_price(exchange: str, pair: str) -> Optional[dict]:
    r = get_client()
    raw = await r.get(f"price:{exchange}:{pair}")
    if raw is None:
        return None
    return json.loads(raw)


async def get_available_pairs() -> list[str]:
    r = get_client()
    raw = await r.get("pairs:available")
    if raw is None:
        return []
    return json.loads(raw)
