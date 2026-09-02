import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# NOTE: the ConfidenceLevel / DayNight enums that used to live here were
# removed. They were referenced nowhere, and ConfidenceLevel disagreed with
# the data: it declared "medium" while FIRMS and every row in seed_mock_events
# use "nominal". A vocabulary type that nothing imports and that contradicts
# the database is worse than no type — it looks authoritative while drifting.
# Reintroduce them (as enum.StrEnum) when an endpoint actually validates input.
class ThermalEventCreate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    frp: float | None = Field(None, ge=0, description="Fire Radiative Power in MW")
    brightness: float | None = Field(None, description="Brightness temperature in Kelvin")
    scan: float | None = None
    track: float | None = None
    satellite: str | None = None
    instrument: str | None = None
    confidence: str | None = None
    daynight: str | None = None
    version: str | None = None
    acq_date: datetime | None = None
    acq_time: str | None = None
    source_url: str | None = None
    raw_payload: str | None = None


class ThermalEventResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    latitude: float
    longitude: float
    frp: float | None = None
    brightness: float | None = None
    scan: float | None = None
    track: float | None = None
    satellite: str | None = None
    instrument: str | None = None
    confidence: str | None = None
    daynight: str | None = None
    version: str | None = None
    acq_date: datetime | None = None
    acq_time: str | None = None
    source_url: str | None = None
    created_at: datetime
    updated_at: datetime


class ThermalEventList(BaseModel):
    items: list[ThermalEventResponse]
    total: int
    page: int
    page_size: int
    pages: int


class EventFilter(BaseModel):
    lat_min: float | None = Field(None, ge=-90, le=90)
    lat_max: float | None = Field(None, ge=-90, le=90)
    lon_min: float | None = Field(None, ge=-180, le=180)
    lon_max: float | None = Field(None, ge=-180, le=180)
    radius_km: float | None = Field(None, gt=0, le=500)
    center_lat: float | None = Field(None, ge=-90, le=90)
    center_lon: float | None = Field(None, ge=-180, le=180)
    confidence: str | None = None
    satellite: str | None = None
    daynight: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    frp_min: float | None = Field(None, ge=0)
    frp_max: float | None = Field(None, ge=0)
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
