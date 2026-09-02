import uuid
from datetime import datetime

from sqlalchemy import Float, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.geo import PointColumn


class IndustrialSite(Base):
    __tablename__ = "industrial_sites"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    industry_type: Mapped[str] = mapped_column(
        String(128), nullable=False, comment="petrochemical, steel, cement, etc."
    )
    region: Mapped[str] = mapped_column(String(128), nullable=False, comment="State or zone name")
    district: Mapped[str | None] = mapped_column(String(128), nullable=True)
    state: Mapped[str | None] = mapped_column(String(64), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    geometry: Mapped[str] = mapped_column(PointColumn(), nullable=False)
    risk_level: Mapped[str] = mapped_column(
        String(16), nullable=False, default="medium", comment="low/medium/high/critical"
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<IndustrialSite {self.name}>"
