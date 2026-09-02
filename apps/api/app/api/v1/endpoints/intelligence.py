from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.intelligence import PersistentSourcesResponse, WatchtowerDigest
from app.services import intelligence_service
from app.services.intelligence_service import WINDOW_DAYS

router = APIRouter()


@router.get("/persistent-sources", response_model=PersistentSourcesResponse)
async def persistent_sources(
    window_days: int = Query(
        WINDOW_DAYS, ge=1, le=365, description="Look-back window in days"
    ),
    db: AsyncSession = Depends(get_db),
) -> PersistentSourcesResponse:
    """
    Recurring thermal sources, clustered and ranked.

    Derived from ThermalEvent rows in the window — no dedicated table. Returns
    an empty ``sources`` list when the database has no events, which is the
    correct answer for a freshly seeded instance, not an error.
    """
    return await intelligence_service.get_persistent_sources(db, window_days)


@router.get("/watchtower", response_model=WatchtowerDigest)
async def watchtower(
    window_days: int = Query(
        WINDOW_DAYS, ge=1, le=365, description="Look-back window in days"
    ),
    db: AsyncSession = Depends(get_db),
) -> WatchtowerDigest:
    """The monitoring digest: new, priority and review-worthy counts."""
    return await intelligence_service.get_watchtower(db, window_days)
