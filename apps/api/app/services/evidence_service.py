import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.classification import Classification
from app.models.industrial_site import IndustrialSite
from app.models.thermal_event import ThermalEvent
from app.schemas.evidence import (
    EvidenceComponent,
    EvidenceResponse,
    NearbySiteInfo,
)
from app.utils.geometry import haversine_distance


async def assemble_evidence(
    db: AsyncSession, event_id: uuid.UUID
) -> EvidenceResponse | None:
    event = (
        await db.execute(
            select(ThermalEvent).where(ThermalEvent.id == event_id)
        )
    ).scalar_one_or_none()
    if event is None:
        return None

    classification = (
        await db.execute(
            select(Classification)
            .where(Classification.event_id == event_id)
            .order_by(Classification.confidence.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    label = classification.label if classification else "unknown"
    conf = classification.confidence if classification else 0.0

    components: list[EvidenceComponent] = []

    frp_value = event.frp or 0.0
    components.append(
        EvidenceComponent(
            component_type="thermal_signature",
            label="Fire Radiative Power (FRP)",
            description=(
                f"FRP measured at {frp_value} MW. "
                + (
                    "This is significantly elevated and consistent with an "
                    "active industrial fire."
                    if frp_value > 50
                    else "This is moderate and may indicate controlled burning "
                    "or smaller incidents."
                    if frp_value > 15
                    else "Low FRP suggests minimal thermal activity."
                )
            ),
            value=frp_value,
            unit="MW",
            weight=0.35,
        )
    )

    brightness_value = event.brightness or 0.0
    components.append(
        EvidenceComponent(
            component_type="satellite_data",
            label="Brightness Temperature",
            description=(
                f"Satellite-measured brightness of {brightness_value}K. "
                + (
                    "Consistent with high-temperature combustion sources."
                    if brightness_value > 330
                    else "Moderate thermal signature."
                    if brightness_value > 300
                    else "Low brightness temperature, possibly non-fire source."
                )
            ),
            value=brightness_value,
            unit="K",
            weight=0.25,
        )
    )

    # NOTE: every industrial site is loaded and filtered in Python. That is
    # fine while the table holds hundreds of rows, and it keeps the query
    # portable to SQLite for tests. The geometry column exists so this can
    # become a PostGIS ST_DWithin predicate once the table is large.
    sites_result = await db.execute(select(IndustrialSite))
    all_sites = sites_result.scalars().all()
    nearby_sites: list[NearbySiteInfo] = []
    for site in all_sites:
        # Haversine, replacing the (dlat * 111) shortcut that was here.
        # That shortcut omits the cos(latitude) factor, so it inflates
        # east-west distances by ~6% at Indian latitudes — enough to push a
        # real site across the 50 km threshold, or to invent one.
        dist_km = haversine_distance(
            event.latitude, event.longitude, site.latitude, site.longitude
        )
        if dist_km <= 50:
            nearby_sites.append(
                NearbySiteInfo(
                    site_id=site.id,
                    name=site.name,
                    industry_type=site.industry_type,
                    distance_km=round(dist_km, 2),
                    risk_level=site.risk_level,
                )
            )
    nearby_sites.sort(key=lambda s: s.distance_km)

    proximity_weight = 0.20 if nearby_sites else 0.05
    nearest_name = nearby_sites[0].name if nearby_sites else "none within 50 km"
    components.append(
        EvidenceComponent(
            component_type="spatial_proximity",
            label="Proximity to Industrial Sites",
            description=(
                f"Nearest industrial site: {nearest_name}. "
                + f"{len(nearby_sites)} site(s) within 50 km radius."
                if nearby_sites
                else "No industrial sites within 50 km."
            ),
            value=float(nearby_sites[0].distance_km) if nearby_sites else None,
            unit="km",
            weight=proximity_weight,
        )
    )

    confidence_str = event.confidence or "unknown"
    components.append(
        EvidenceComponent(
            component_type="historical_pattern",
            label="FIRMS Confidence Level",
            description=(
                f"NASA FIRMS reported confidence: {confidence_str}. "
                + (
                    "High-confidence detections have historically correlated with confirmed fires."
                    if confidence_str == "high"
                    else "Nominal confidence; cross-verification recommended."
                    if confidence_str == "nominal"
                    else "Low confidence; may be noise or non-fire thermal anomaly."
                )
            ),
            value=1.0 if confidence_str == "high" else 0.5 if confidence_str == "nominal" else 0.2,
            unit="score",
            weight=0.15,
        )
    )

    total_weight = sum(c.weight for c in components)
    reasoning_parts = [
        f"Event classified as '{label}' with {conf:.0%} confidence.",
    ]
    for c in components:
        normalized_w = c.weight / total_weight if total_weight > 0 else 0
        reasoning_parts.append(
            f"[{normalized_w:.0%} weight] {c.label}: {c.description}"
        )

    return EvidenceResponse(
        event_id=event_id,
        classification_label=label,
        classification_confidence=conf,
        components=components,
        nearby_sites=nearby_sites[:10],
        reasoning_summary=" ".join(reasoning_parts),
        generated_at=datetime.now(UTC),
    )
