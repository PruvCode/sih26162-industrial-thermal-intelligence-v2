from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import BadRequestError
from app.schemas.analytics import AnalyticsSummary
from app.schemas.intelligence import DensityResponse
from app.services import intelligence_service
from app.services.analytics_service import get_analytics_summary

router = APIRouter()


@router.get("/summary", response_model=AnalyticsSummary)
async def analytics_summary(
    db: AsyncSession = Depends(get_db),
) -> AnalyticsSummary:
    return await get_analytics_summary(db)


@router.get("/density", response_model=DensityResponse)
async def analytics_density(
    bbox: str | None = Query(
        None,
        description="Comma-separated west,south,east,north. Defaults to India.",
    ),
    cell_size: float = Query(0.1, gt=0, le=1, description="Grid cell size in degrees."),
    db: AsyncSession = Depends(get_db),
) -> DensityResponse:
    """
    Heatmap cells: event count, mean FRP and dominant class per grid cell.

    ``bbox`` lets the frontend request only the visible region; anything
    outside the box is dropped before bucketing.
    """
    parsed_bbox = None
    if bbox:
        parts = [float(p) for p in bbox.split(",")]
        if len(parts) != 4:
            raise BadRequestError(
                "bbox must be 4 comma-separated numbers (west,south,east,north)",
                details={"example": "68,8,98,37"},
            )
        parsed_bbox = tuple(parts)
    return await intelligence_service.get_density(db, bbox=parsed_bbox, cell_size=cell_size)
