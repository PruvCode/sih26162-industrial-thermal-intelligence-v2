import uuid
from datetime import datetime

from sqlalchemy import Float, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Classification(Base):
    __tablename__ = "classifications"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment=(
            "One of classification_service.LABELS — industrial_fire, "
            "persistent_thermal_source, natural_wildfire, other. "
            "The frontend renders anything else as 'no classification'."
        ),
    )
    confidence: Mapped[float] = mapped_column(
        Float, nullable=False, comment="0.0 to 1.0"
    )
    model_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    explanation: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Human-readable explanation"
    )
    features_used: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="JSON list of feature names"
    )
    evidence_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    classified_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<Classification {self.label} ({self.confidence:.2f})>"
