import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class EvidenceComponent(BaseModel):
    component_type: str = Field(
        ...,
        description=(
            "e.g. thermal_signature, spatial_proximity, historical_pattern, "
            "satellite_data"
        ),
    )
    label: str
    description: str
    value: float | None = None
    unit: str | None = None
    weight: float = Field(0.0, ge=0.0, le=1.0, description="Contribution to final classification")


class NearbySiteInfo(BaseModel):
    site_id: uuid.UUID
    name: str
    industry_type: str
    distance_km: float
    risk_level: str


class EvidenceResponse(BaseModel):
    event_id: uuid.UUID
    classification_label: str
    classification_confidence: float
    components: list[EvidenceComponent]
    nearby_sites: list[NearbySiteInfo]
    reasoning_summary: str
    generated_at: datetime
