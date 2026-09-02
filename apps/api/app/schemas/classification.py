import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ClassificationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    event_id: uuid.UUID
    label: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    model_version: str | None = None
    explanation: str | None = None
    features_used: str | None = None
    evidence_summary: str | None = None
    classified_at: datetime
    created_at: datetime
