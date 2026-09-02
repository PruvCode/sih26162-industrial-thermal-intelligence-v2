import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import NotFoundError
from app.schemas.classification import ClassificationResponse
from app.schemas.event import EventFilter, ThermalEventList, ThermalEventResponse
from app.schemas.evidence import EvidenceResponse
from app.schemas.intelligence import EventReportResponse
from app.services import classification_service, event_service, evidence_service
from app.services.intelligence_service import get_event_report

router = APIRouter()


async def _get_event_or_404(db: AsyncSession, event_id: uuid.UUID):
    """Load an event or raise the app's standard 404 envelope."""
    event = await event_service.get_thermal_event(db, event_id)
    if event is None:
        raise NotFoundError(
            "Event not found", details={"event_id": str(event_id)}
        )
    return event


@router.get("", response_model=ThermalEventList)
async def list_events(
    lat_min: float | None = Query(None),
    lat_max: float | None = Query(None),
    lon_min: float | None = Query(None),
    lon_max: float | None = Query(None),
    radius_km: float | None = Query(None),
    center_lat: float | None = Query(None),
    center_lon: float | None = Query(None),
    confidence: str | None = Query(None),
    satellite: str | None = Query(None),
    daynight: str | None = Query(None),
    # Typed as datetime rather than str on purpose.
    #
    # FastAPI validates the wire format and answers 422 with the offending
    # field name. The previous version accepted str and called
    # datetime.fromisoformat() inside the handler, so ?date_from=banana
    # escaped as an unhandled ValueError and returned a 500.
    date_from: datetime | None = Query(
        None, description="ISO date or datetime, e.g. 2026-08-30"
    ),
    date_to: datetime | None = Query(
        None, description="ISO date or datetime, e.g. 2026-08-30"
    ),
    frp_min: float | None = Query(None, ge=0),
    frp_max: float | None = Query(None, ge=0),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> ThermalEventList:
    filters = EventFilter(
        lat_min=lat_min,
        lat_max=lat_max,
        lon_min=lon_min,
        lon_max=lon_max,
        radius_km=radius_km,
        center_lat=center_lat,
        center_lon=center_lon,
        confidence=confidence,
        satellite=satellite,
        daynight=daynight,
        date_from=date_from,
        date_to=date_to,
        frp_min=frp_min,
        frp_max=frp_max,
        page=page,
        page_size=page_size,
    )
    events, total = await event_service.list_thermal_events(db, filters)
    pages = (total + page_size - 1) // page_size

    return ThermalEventList(
        items=[ThermalEventResponse.model_validate(e) for e in events],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{event_id}", response_model=ThermalEventResponse)
async def get_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ThermalEventResponse:
    event = await _get_event_or_404(db, event_id)
    return ThermalEventResponse.model_validate(event)


@router.get("/{event_id}/history")
async def get_event_history(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    # The 404 check is not redundant: without it, an unknown id would return
    # an empty list, which is indistinguishable from "known event, no history".
    await _get_event_or_404(db, event_id)
    return await event_service.get_historical_observations(db, event_id)


@router.get("/{event_id}/evidence", response_model=EvidenceResponse)
async def get_event_evidence(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> EvidenceResponse:
    await _get_event_or_404(db, event_id)

    # Deliberately read-only.
    #
    # This handler used to call classification_service.classify_event(), which
    # wrote a Classification row as a side effect of a GET. That makes the
    # request non-idempotent, lets a link preview or crawler insert data, and
    # means a retry after a timeout does different things. Classification is
    # now an explicit POST /{event_id}/classify.
    #
    # Evidence still assembles fine for an unclassified event — it reports
    # label "unknown" with confidence 0.
    evidence = await evidence_service.assemble_evidence(db, event_id)
    if evidence is None:
        raise NotFoundError(
            "Event not found", details={"event_id": str(event_id)}
        )
    return evidence


@router.post("/{event_id}/classify", response_model=ClassificationResponse)
async def classify_event(
    event_id: uuid.UUID,
    response: Response,
    force: bool = Query(
        False, description="Re-classify even if a result already exists"
    ),
    db: AsyncSession = Depends(get_db),
) -> ClassificationResponse:
    await _get_event_or_404(db, event_id)
    classification, created = await classification_service.classify_event(
        db, event_id, force=force
    )
    # 201 only when a row was actually written; replaying an existing
    # classification is a 200.
    response.status_code = (
        status.HTTP_201_CREATED if created else status.HTTP_200_OK
    )
    return ClassificationResponse.model_validate(classification)


@router.get("/{event_id}/report", response_model=EventReportResponse)
async def event_report(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> EventReportResponse:
    """
    Structured, export-ready intelligence report for one event.

    Assembled from the event row, its classification(s), its evidence and its
    historical observations. A missing event is a 404; an unclassified event
    still produces a report (it reports "other" / 0 confidence) rather than
    failing.
    """
    report = await get_event_report(db, event_id)
    if report is None:
        raise NotFoundError(
            "Event not found", details={"event_id": str(event_id)}
        )
    return report
