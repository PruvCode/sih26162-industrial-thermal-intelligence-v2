import uuid
from datetime import datetime

from sqlalchemy import Float, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class HistoricalObservation(Base):
    __tablename__ = "historical_observations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), nullable=False, index=True
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    frp: Mapped[float | None] = mapped_column(Float, nullable=True)
    brightness: Mapped[float | None] = mapped_column(Float, nullable=True)
    satellite: Mapped[str | None] = mapped_column(String(16), nullable=True)
    acq_date: Mapped[datetime | None] = mapped_column(nullable=True)
    obs_number: Mapped[int] = mapped_column(
        nullable=False, comment="Sequential observation number"
    )
    time_delta_hours: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="Hours since first observation"
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<HistoricalObservation event={self.event_id} obs#{self.obs_number}>"
