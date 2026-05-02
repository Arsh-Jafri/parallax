import os

from sqlalchemy import Column, DateTime, Integer, Numeric, String, func, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://parallax:parallax@localhost:5432/parallax",
)

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


class Spread(Base):
    __tablename__ = "spreads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pair = Column(String(20), nullable=False, index=True)
    exchange_buy = Column(String(20), nullable=False)
    exchange_sell = Column(String(20), nullable=False)
    raw_spread = Column(Numeric(10, 6), nullable=False)
    net_spread = Column(Numeric(10, 6), nullable=False)
    captured_at = Column(DateTime(timezone=True), server_default=func.now())


class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pair = Column(String(20), nullable=False, index=True)
    buy_exchange = Column(String(20), nullable=False)
    sell_exchange = Column(String(20), nullable=False)
    buy_price = Column(Numeric(20, 8), nullable=False)
    sell_price = Column(Numeric(20, 8), nullable=False)
    raw_spread = Column(Numeric(10, 6), nullable=False)
    net_spread = Column(Numeric(10, 6), nullable=False)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Create time-series indexes if they don't exist
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_spreads_pair_time "
            "ON spreads (pair, captured_at DESC)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_opportunities_pair_time "
            "ON opportunities (pair, detected_at DESC)"
        ))
