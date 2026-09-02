"""
Alembic environment.

Points at ``Base.metadata`` so migrations stay in lock-step with the ORM
models in ``app/models``. The target database is PostgreSQL + PostGIS; the
initial migration emits real ``geometry(POINT, 4326)`` columns.

The test suite does NOT use Alembic — it calls ``Base.metadata.create_all``
against an in-memory SQLite (where the geometry column degrades to TEXT; see
``app/models/geo.py``). Alembic is the production path: ``alembic upgrade head``
on a fresh Postgres.
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import get_settings
from app.core.database import Base

config = context.config

# Pull the real URL from settings rather than hard-coding it in alembic.ini.
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit SQL without a DB connection (used for code review / SQL output)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # Compare types so a later change to a column (e.g. widening a String)
        # is detected, but ignore the geometry Text-vs-Geometry dialect gap.
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def _run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(_run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
