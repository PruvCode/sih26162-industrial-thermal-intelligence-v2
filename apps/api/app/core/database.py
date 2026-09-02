"""
Database engine, session factory, and the FastAPI dependency that hands out
sessions.

Design notes (both of these were bugs before, fixed here):

* **The engine is created lazily.** It used to be built at import time, which
  meant `import app.main` failed outright when `asyncpg` was missing, and meant
  `get_settings()` had already been read before tests could override it. Now
  nothing touches the database until something actually asks for a session.

* **A session is only ever obtained through `get_db`.** If a module builds its
  own session it will eventually leak one, and there will be no rollback on
  error.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import MetaData, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

logger = logging.getLogger("api.database")

# Explicit constraint names. Without this, Alembic autogenerate produces
# migrations full of unnamed constraints it can never later drop or alter.
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=convention)


class Base(DeclarativeBase):
    metadata = metadata


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _engine_kwargs(url: str) -> dict[str, object]:
    """Driver-specific options — SQLite (used by the tests) rejects the pool args."""
    settings = get_settings()
    if url.startswith("sqlite"):
        return {}
    return {
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_timeout": settings.DB_POOL_TIMEOUT_SECONDS,
        # Detects connections killed by the database/proxy while idle.
        "pool_pre_ping": True,
    }


def get_engine() -> AsyncEngine:
    """Return the process-wide engine, creating it on first use."""
    global _engine
    if _engine is None:
        settings = get_settings()
        url = settings.DATABASE_URL
        logger.info("Creating database engine for %s", _redact_url(url))
        _engine = create_async_engine(
            url,
            echo=settings.SQL_ECHO,
            future=True,
            **_engine_kwargs(url),  # type: ignore[arg-type]
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the process-wide session factory, creating it on first use."""
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_engine(),
            class_=AsyncSession,
            # Without this, every commit expires loaded attributes and a
            # response serialiser trips a lazy load outside the request.
            expire_on_commit=False,
            # Explicit flushes only — an implicit flush mid-query is a
            # bewildering source of "why did that row change".
            autoflush=False,
        )
    return _session_factory


async def dispose_engine() -> None:
    """Close pooled connections. Called from the lifespan shutdown handler."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        logger.info("Database engine disposed.")
        _engine = None
        _session_factory = None


def reset_engine() -> None:
    """
    Forget the cached engine without disposing it.

    For tests that swap DATABASE_URL: call ``get_settings.cache_clear()`` then
    this, and the next session builds against the new URL.
    """
    global _engine, _session_factory
    _engine = None
    _session_factory = None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yield a session for one request.

    Commits on success, rolls back on any exception, always closes. The close is
    what keeps the pool from running dry under load.
    """
    async with get_session_factory()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_database() -> tuple[bool, str]:
    """
    Run a trivial query and report whether the database answers.

    Returns ``(ok, detail)`` instead of raising, because the caller is the
    health endpoint — it has to render "database: down" as a *response*, not as
    a 500.
    """
    try:
        factory = get_session_factory()
        async with factory() as session:
            await session.execute(text("SELECT 1"))
        return True, "ok"
    except Exception as exc:  # noqa: BLE001 - a health check must not raise
        logger.warning("Database health check failed: %s", exc)
        return False, exc.__class__.__name__


def _redact_url(url: str) -> str:
    """Strip the password before a URL reaches a log line."""
    if "://" not in url:
        return url
    scheme, rest = url.split("://", 1)
    if "@" not in rest:
        return url
    creds, host = rest.rsplit("@", 1)
    user = creds.split(":", 1)[0]
    return f"{scheme}://{user}:***@{host}"


# Shorthand so endpoints write `db: DbSession` instead of repeating
# `Depends(get_db)`, and so service functions can take a plain `AsyncSession`
# without importing FastAPI at all.
DbSession = Annotated[AsyncSession, Depends(get_db)]
