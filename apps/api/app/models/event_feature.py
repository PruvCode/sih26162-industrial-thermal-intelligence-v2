import uuid
from datetime import datetime

from sqlalchemy import Float, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class EventFeature(Base):
    __tablename__ = "event_features"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), nullable=False, index=True
    )
    feature_name: Mapped[str] = mapped_column(String(128), nullable=False)
    feature_value: Mapped[float] = mapped_column(Float, nullable=False)
    feature_unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    feature_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    computed_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<EventFeature {self.feature_name}={self.feature_value}>"
