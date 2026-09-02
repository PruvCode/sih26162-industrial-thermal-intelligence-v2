"""
Schemas for the four endpoints the frontend's live provider expects but that
the original backend never shipped:

* GET /api/v1/persistent-sources   -> PersistentSourcesResponse
* GET /api/v1/watchtower           -> WatchtowerDigest
* GET /api/v1/analytics/density    -> DensityResponse
* GET /api/v1/events/{id}/report   -> EventReportResponse

These are *view* models — every value is derived from the same ThermalEvent /
IndustrialSite / Classification tables the rest of the API reads. That is
deliberate: it means the hotspot ranking, the heatmap and the per-event report
can never disagree with the event list, which is the exact inconsistency the
frontend was built to avoid.

Field names are camelCase-free (snake_case) on the wire; the frontend mapper
is responsible for the camelCase domain types in src/types/intelligence.ts.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DensityCell(BaseModel):
    lat: float
    lon: float
    count: int
    mean_frp: float | None = None
    # One of classification_service.LABELS, or "other" when no classification
    # exists yet (the demo seed has none until /classify is called).
    dominant_class: str


class DensityResponse(BaseModel):
    bbox: list[float] = Field(..., description="[west, south, east, north]")
    cell_size_deg: float
    cells: list[DensityCell]
    generated_at: datetime


class PersistentSource(BaseModel):
    hotspot_id: int
    label: str
    kind: str = Field(..., description="industrial | wildfire | residue")
    state: str
    district: str
    lat: float
    lon: float
    active_days: int
    detection_count: int
    dominant_class: str
    max_frp: float | None = None
    avg_brightness: float | None = None
    priority_score: float
    facility_name: str | None = None
    facility_type: str | None = None
    distance_km: float | None = None
    first_date: str | None = None
    last_date: str | None = None


class PersistentSourcesResponse(BaseModel):
    window_days: int
    generated_at: datetime
    sources: list[PersistentSource]


class WatchtowerDigest(BaseModel):
    generated_at: datetime
    window_days: int
    new_events: int
    priority_events: int
    requires_review: int
    persistent_sources: int
    by_class: list[dict] = Field(..., description="[{category, count, percentage}]")
    top_regions: list[dict] = Field(..., description="[{state, count}]")


class EventReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: str
    generated_at: datetime
    classification: str
    classification_label: str
    confidence: float
    confidence_band: str
    priority_band: str
    priority_score: float
    location: dict
    persistence: dict
    thermal: dict
    nearest_facility: dict | None = None
    key_evidence: list[dict]
    caveats: list[str]
    provenance: dict
