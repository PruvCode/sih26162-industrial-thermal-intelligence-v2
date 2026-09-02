"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-02 00:00:00.000000

Creates the core tables for the thermal-intelligence backend:
thermal_events, classifications, historical_observations, industrial_sites,
event_features.

The geometry columns are emitted as PostGIS ``geometry(POINT, 4326)`` because
the target database is PostgreSQL + PostGIS. (On SQLite, the same model
column degrades to TEXT via app/models/geo.py — that is for tests only and is
NOT what this migration produces.)

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry as GeoGeometry
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NOW = sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "thermal_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column(
            "geometry",
            GeoGeometry(geometry_type="POINT", srid=4326),
            nullable=False,
        ),
        sa.Column("frp", sa.Float(), nullable=True),
        sa.Column("brightness", sa.Float(), nullable=True),
        sa.Column("scan", sa.Float(), nullable=True),
        sa.Column("track", sa.Float(), nullable=True),
        sa.Column("satellite", sa.String(length=16), nullable=True),
        sa.Column("instrument", sa.String(length=16), nullable=True),
        sa.Column("confidence", sa.String(length=16), nullable=True),
        sa.Column("daynight", sa.String(length=8), nullable=True),
        sa.Column("version", sa.String(length=8), nullable=True),
        sa.Column("acq_date", sa.DateTime(), nullable=True),
        sa.Column("acq_time", sa.String(length=8), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("raw_payload", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=NOW, nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "classifications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("label", sa.String(length=64), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("model_version", sa.String(length=32), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("features_used", sa.Text(), nullable=True),
        sa.Column("evidence_summary", sa.Text(), nullable=True),
        sa.Column("classified_at", sa.DateTime(), server_default=NOW, nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["thermal_events.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_classifications_event_id", "classifications", ["event_id"])

    op.create_table(
        "historical_observations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("frp", sa.Float(), nullable=True),
        sa.Column("brightness", sa.Float(), nullable=True),
        sa.Column("satellite", sa.String(length=16), nullable=True),
        sa.Column("acq_date", sa.DateTime(), nullable=True),
        sa.Column("obs_number", sa.Integer(), nullable=False),
        sa.Column("time_delta_hours", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["thermal_events.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_historical_observations_event_id",
        "historical_observations",
        ["event_id"],
    )

    op.create_table(
        "industrial_sites",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("industry_type", sa.String(length=128), nullable=False),
        sa.Column("region", sa.String(length=128), nullable=False),
        sa.Column("district", sa.String(length=128), nullable=True),
        sa.Column("state", sa.String(length=64), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column(
            "geometry",
            GeoGeometry(geometry_type="POINT", srid=4326),
            nullable=False,
        ),
        sa.Column(
            "risk_level",
            sa.String(length=16),
            server_default=sa.text("'medium'"),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=NOW, nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "event_features",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("feature_name", sa.String(length=128), nullable=False),
        sa.Column("feature_value", sa.Float(), nullable=False),
        sa.Column("feature_unit", sa.String(length=32), nullable=True),
        sa.Column("feature_description", sa.Text(), nullable=True),
        sa.Column("computed_at", sa.DateTime(), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["thermal_events.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_event_features_event_id", "event_features", ["event_id"]
    )


def downgrade() -> None:
    op.drop_table("event_features")
    op.drop_table("industrial_sites")
    op.drop_index("ix_historical_observations_event_id", table_name="historical_observations")
    op.drop_table("historical_observations")
    op.drop_index("ix_classifications_event_id", table_name="classifications")
    op.drop_table("classifications")
    op.drop_table("thermal_events")
