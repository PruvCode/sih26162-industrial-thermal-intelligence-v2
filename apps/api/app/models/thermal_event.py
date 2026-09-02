import uuid
from datetime import datetime

from sqlalchemy import Float, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.geo import PointColumn


class ThermalEvent(Base):
    __tablename__ = "thermal_events"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    geometry: Mapped[str] = mapped_column(PointColumn(), nullable=False)
    frp: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="Fire Radiative Power in MW"
    )
    brightness: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="Brightness temperature in Kelvin"
    )
    scan: Mapped[float | None] = mapped_column(Float, nullable=True)
    track: Mapped[float | None] = mapped_column(Float, nullable=True)
    satellite: Mapped[str | None] = mapped_column(String(16), nullable=True)
    instrument: Mapped[str | None] = mapped_column(String(16), nullable=True)
    confidence: Mapped[str | None] = mapped_column(
        String(16), nullable=True, comment="FIRMS category: low | nominal | high"
    )
    daynight: Mapped[str | None] = mapped_column(String(8), nullable=True)
    version: Mapped[str | None] = mapped_column(String(8), nullable=True)
    acq_date: Mapped[datetime | None] = mapped_column(nullable=True)
    acq_time: Mapped[str | None] = mapped_column(String(8), nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_payload: Mapped[str | None] = mapped_column(Text, nullable=True, comment="Raw FIRMS JSON")
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<ThermalEvent {self.id} ({self.latitude}, {self.longitude})>"
