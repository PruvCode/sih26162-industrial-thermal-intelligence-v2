"""
A dialect-aware POINT column.

The problem this solves
-----------------------
Production is PostgreSQL + PostGIS, where this column is a real
``geometry(POINT, 4326)`` and can be queried with ``ST_DWithin``. The test
suite runs SQLite, where GeoAlchemy2 cannot even emit a ``CREATE TABLE``:
plain aiosqlite has no SpatiaLite extension, so ``create_all`` dies with
``no such function: RecoverGeometryColumn``.

The compromise
--------------
On PostgreSQL this is a GeoAlchemy2 ``Geometry``; anywhere else it degrades to
a WKT text column. The schema stays creatable on both, and the ORM surface is
identical — application code always assigns a ``WKTElement`` and never
depends on what comes back, because ``latitude``/``longitude`` are the values
actually read.

Limits you must respect
-----------------------
The SQLite branch exists so that ``pytest`` runs with zero infrastructure. It
is NOT a working spatial database:

* No spatial index, no spatial functions, no ``ST_DWithin``.
* Any query using a spatial predicate is PostgreSQL-only. Today that is
  ``_haversine_condition()`` in ``app/services/event_service.py``, which is
  only reached when ``center_lat``/``center_lon``/``radius_km`` are all given.

Once CI can run against a real PostGIS container, prefer that over this
shim — a test suite that exercises a different storage engine than production
can only catch so much.
"""

from __future__ import annotations

from geoalchemy2 import Geometry
from geoalchemy2.elements import WKTElement
from sqlalchemy import Text
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TypeDecorator


class PointColumn(TypeDecorator):
    """``geometry(POINT, 4326)`` on PostgreSQL, WKT text on everything else."""

    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect: Dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(
                Geometry(geometry_type="POINT", srid=4326, management=True)
            )
        return dialect.type_descriptor(Text())

    def process_bind_param(
        self, value: WKTElement | str | None, dialect: Dialect
    ) -> WKTElement | str | None:
        if value is None or dialect.name == "postgresql":
            return value
        # SQLite has no geometry type, so persist the Well-Known Text instead.
        # Read .data explicitly rather than relying on str() — WKTElement does
        # not promise a particular __str__, and silently writing a repr like
        # "<WKTElement at 0x...>" into the column would be a nightmare to debug.
        if isinstance(value, WKTElement):
            return value.data
        return str(value)

    def process_result_value(
        self, value: WKTElement | str | None, dialect: Dialect
    ) -> WKTElement | str | None:
        # Nothing in the codebase reads this column back — the flat
        # latitude/longitude columns are the source of truth for reads.
        return value
