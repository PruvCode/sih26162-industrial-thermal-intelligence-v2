import uuid
from datetime import UTC, datetime

from geoalchemy2 import WKTElement
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.thermal_event import ThermalEvent
from app.schemas.event import EventFilter, ThermalEventCreate

settings = get_settings()


def _haversine_condition(
    center_lat: float, center_lon: float, radius_km: float
) -> str:
    """Return PostGIS ST_DWithin raw SQL fragment using Haversine approximation."""
    return (
        f"ST_DWithin(geometry::geography, "
        f"ST_SetSRID(ST_MakePoint({center_lon}, {center_lat}), 4326)::geography, "
        f"{radius_km * 1000})"
    )


async def create_thermal_event(
    db: AsyncSession, payload: ThermalEventCreate
) -> ThermalEvent:
    geom = WKTElement(f"POINT({payload.longitude} {payload.latitude})", srid=4326)
    event = ThermalEvent(
        latitude=payload.latitude,
        longitude=payload.longitude,
        geometry=geom,
        frp=payload.frp,
        brightness=payload.brightness,
        scan=payload.scan,
        track=payload.track,
        satellite=payload.satellite,
        instrument=payload.instrument,
        confidence=payload.confidence,
        daynight=payload.daynight,
        version=payload.version,
        acq_date=payload.acq_date,
        acq_time=payload.acq_time,
        source_url=payload.source_url,
        raw_payload=payload.raw_payload,
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


async def get_thermal_event(db: AsyncSession, event_id: uuid.UUID) -> ThermalEvent | None:
    result = await db.execute(
        select(ThermalEvent).where(ThermalEvent.id == event_id)
    )
    return result.scalar_one_or_none()


async def list_thermal_events(
    db: AsyncSession, filters: EventFilter
) -> tuple[list[ThermalEvent], int]:
    query = select(ThermalEvent)

    if filters.lat_min is not None:
        query = query.where(ThermalEvent.latitude >= filters.lat_min)
    if filters.lat_max is not None:
        query = query.where(ThermalEvent.latitude <= filters.lat_max)
    if filters.lon_min is not None:
        query = query.where(ThermalEvent.longitude >= filters.lon_min)
    if filters.lon_max is not None:
        query = query.where(ThermalEvent.longitude <= filters.lon_max)
    if filters.confidence:
        query = query.where(ThermalEvent.confidence == filters.confidence)
    if filters.satellite:
        query = query.where(ThermalEvent.satellite == filters.satellite)
    if filters.daynight:
        query = query.where(ThermalEvent.daynight == filters.daynight)
    if filters.date_from:
        query = query.where(ThermalEvent.acq_date >= filters.date_from)
    if filters.date_to:
        query = query.where(ThermalEvent.acq_date <= filters.date_to)
    if filters.frp_min is not None:
        query = query.where(ThermalEvent.frp >= filters.frp_min)
    if filters.frp_max is not None:
        query = query.where(ThermalEvent.frp <= filters.frp_max)

    if (
        filters.center_lat is not None
        and filters.center_lon is not None
        and filters.radius_km is not None
    ):
        spatial_filter = _haversine_condition(
            filters.center_lat, filters.center_lon, filters.radius_km
        )
        query = query.where(spatial_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    offset = (filters.page - 1) * filters.page_size
    query = query.order_by(ThermalEvent.created_at.desc()).offset(offset).limit(filters.page_size)

    result = await db.execute(query)
    events = list(result.scalars().all())

    return events, total


async def get_historical_observations(
    db: AsyncSession, event_id: uuid.UUID
) -> list[dict]:
    """Return the raw historical observations for an event (mocked for now)."""
    from app.models.historical_observation import HistoricalObservation

    result = await db.execute(
        select(HistoricalObservation)
        .where(HistoricalObservation.event_id == event_id)
        .order_by(HistoricalObservation.obs_number)
    )
    return [
        {
            "id": str(obs.id),
            "obs_number": obs.obs_number,
            "latitude": obs.latitude,
            "longitude": obs.longitude,
            "frp": obs.frp,
            "brightness": obs.brightness,
            "satellite": obs.satellite,
            "acq_date": obs.acq_date.isoformat() if obs.acq_date else None,
            "time_delta_hours": obs.time_delta_hours,
        }
        for obs in result.scalars().all()
    ]


async def seed_mock_events(db: AsyncSession) -> int:
    """Insert realistic Indian industrial thermal events if table is empty."""
    result = await db.execute(select(func.count()).select_from(ThermalEvent))
    if result.scalar() or 0 > 0:
        return 0

    mock_events = [
        ThermalEventCreate(
            latitude=22.3039, longitude=70.8022, frp=45.2, brightness=320.1,
            satellite="VIIRS", instrument="VIIRS", confidence="high", daynight="D",
            acq_date=datetime(2026, 8, 1, 10, 30, tzinfo=UTC),
        ),
        ThermalEventCreate(
            latitude=21.1702, longitude=72.8311, frp=128.7, brightness=345.8,
            satellite="VIIRS", instrument="VIIRS", confidence="high", daynight="N",
            acq_date=datetime(2026, 8, 1, 22, 0, tzinfo=UTC),
        ),
        ThermalEventCreate(
            latitude=19.0760, longitude=72.8777, frp=22.1, brightness=301.4,
            satellite="MODIS", instrument="MODIS", confidence="nominal", daynight="D",
            acq_date=datetime(2026, 8, 2, 5, 15, tzinfo=UTC),
        ),
        ThermalEventCreate(
            latitude=23.0225, longitude=72.5714, frp=89.3, brightness=332.6,
            satellite="VIIRS", instrument="VIIRS", confidence="high", daynight="D",
            acq_date=datetime(2026, 8, 2, 11, 0, tzinfo=UTC),
        ),
        ThermalEventCreate(
            latitude=20.9517, longitude=73.6384, frp=12.4, brightness=295.0,
            satellite="MODIS", instrument="MODIS", confidence="low", daynight="D",
            acq_date=datetime(2026, 8, 3, 4, 45, tzinfo=UTC),
        ),
        ThermalEventCreate(
            latitude=21.6940, longitude=82.1406, frp=210.5, brightness=378.2,
            satellite="VIIRS", instrument="VIIRS", confidence="high", daynight="N",
            acq_date=datetime(2026, 8, 3, 21, 30, tzinfo=UTC),
        ),
        ThermalEventCreate(
            latitude=18.5204, longitude=73.8567, frp=33.6, brightness=310.5,
            satellite="VIIRS", instrument="VIIRS", confidence="nominal", daynight="D",
            acq_date=datetime(2026, 8, 4, 10, 0, tzinfo=UTC),
        ),
        ThermalEventCreate(
            latitude=22.5726, longitude=88.3639, frp=18.9, brightness=305.3,
            satellite="MODIS", instrument="MODIS", confidence="low", daynight="D",
            acq_date=datetime(2026, 8, 4, 5, 30, tzinfo=UTC),
        ),
    ]

    count = 0
    for evt in mock_events:
        await create_thermal_event(db, evt)
        count += 1
    return count
