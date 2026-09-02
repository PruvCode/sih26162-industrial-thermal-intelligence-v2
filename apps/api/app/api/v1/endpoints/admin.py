"""
Development-only data seeding.

This is a convenience for filling a local database with the demo rows so the
intelligence endpoints and the frontend's live provider have something to
show. It is intentionally disabled outside development/test — a public
mass-insert in production is a foot-gun, and real FIRMS ingestion replaces it
entirely.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import NotReadyError
from app.models.classification import Classification
from app.models.thermal_event import ThermalEvent
from app.services.classification_service import seed_mock_classifications
from app.services.event_service import seed_mock_events

router = APIRouter()


@router.post("/seed", status_code=status.HTTP_200_OK)
async def seed_demo_data(db: AsyncSession = Depends(get_db)) -> dict:
    settings = get_settings()
    if settings.is_production:
        raise NotReadyError(
            "Seeding is disabled in production",
            details={"why": "Use real FIRMS ingestion instead of demo rows."},
        )

    n_events = await seed_mock_events(db)
    await db.commit()

    ids = (await db.execute(select(ThermalEvent.id))).scalars().all()
    n_classifications = await seed_mock_classifications(db, list(ids))
    await db.commit()

    total_events = (
        await db.execute(select(func.count()).select_from(ThermalEvent))
    ).scalar() or 0
    total_classifications = (
        await db.execute(select(func.count()).select_from(Classification))
    ).scalar() or 0

    return {
        "events_seeded": n_events,
        "classifications_seeded": n_classifications,
        "total_events": total_events,
        "total_classifications": total_classifications,
        "message": "Demo data inserted (idempotent — repeated calls are no-ops).",
    }
