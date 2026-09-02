"""
Shared test fixtures.

Why it is built this way
------------------------
* **One in-memory SQLite per test, not one per session.** The previous
  version created the schema once for the whole session, so rows written by
  one test were visible to the next. That makes failures depend on execution
  order — the hardest kind to reproduce from a CI log.

* **``StaticPool`` is mandatory here.** With in-memory SQLite, a normal pool
  opens a *new connection* per operation and each connection gets its own
  private empty database. The tables created in the fixture would be invisible
  to the request under test, producing "no such table" for no visible reason.

* **``seeded_client`` exists because an empty database proves very little.**
  Several of the original tests passed against a database with zero rows while
  appearing to exercise filtering and analytics. Tests that matter need data.

This suite does NOT cover PostGIS behaviour. See ``app/models/geo.py`` for
what the SQLite branch can and cannot do, and what it would take to run these
tests against a real PostGIS container.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.services.event_service import seed_mock_events

TEST_DATABASE_URL = "sqlite+aiosqlite://"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def test_engine():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def session_factory(test_engine):
    return async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )


@pytest_asyncio.fixture
async def db_session(session_factory) -> AsyncGenerator[AsyncSession, None]:
    """A raw session, for testing services without going through HTTP."""
    async with session_factory() as session:
        yield session
        await session.rollback()


@asynccontextmanager
async def _http_client(session_factory) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    # A fixture that leaves an override registered silently poisons every
    # later test, so clear it here rather than trusting callers.
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(session_factory) -> AsyncGenerator[AsyncClient, None]:
    """HTTP client backed by an empty database."""
    async with _http_client(session_factory) as ac:
        yield ac


@pytest_asyncio.fixture
async def seeded_client(session_factory) -> AsyncGenerator[AsyncClient, None]:
    """HTTP client backed by a database pre-loaded with the demo events."""
    async with session_factory() as session:
        await seed_mock_events(session)
        await session.commit()
    async with _http_client(session_factory) as ac:
        yield ac
