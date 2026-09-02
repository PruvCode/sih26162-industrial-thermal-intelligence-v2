"""
Derivation for the intelligence endpoints.

None of these need a new table. They are computed from the same
``ThermalEvent`` / ``IndustrialSite`` / ``Classification`` rows the rest of the
API reads, so the hotspot ranking, the heatmap and the per-event report can
never drift apart from the raw event list.

The logic is intentionally simple and deterministic:
* density / clustering bucket events into a fixed grid (``GRID_DEG``),
* "recent" means ``acq_date >= now - window_days`` (falls back to including the
  row when ``acq_date`` is null, so seeded demo rows are never silently dropped),
* a source is "industrial" when it sits within 15 km of an industrial site.

These are prototypes. The same SELECTs are the right place to insert a real
spatial query (ST_DWithin, ST_ClusterDBSCAN) once a PostGIS backend is wired.
"""

from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.classification import Classification
from app.models.industrial_site import IndustrialSite
from app.models.thermal_event import ThermalEvent
from app.services.classification_service import get_classifications_for_event
from app.services.event_service import get_historical_observations
from app.services.evidence_service import assemble_evidence
from app.utils.geometry import haversine_distance

WINDOW_DAYS = 30
# [west, south, east, north] — the area the pilot covers.
INDIA_BBOX = (68.0, 8.0, 98.0, 37.0)
# Grid cell size in degrees (~11 km at the equator). One cell == one cluster.
GRID_DEG = 0.1
# A source within this many km of an industrial site is treated as industrial.
INDUSTRIAL_RADIUS_KM = 15.0


def _now() -> datetime:
    # Naive UTC. The whole stack stores timestamps without a timezone (SQLite
    # cannot keep one; Postgres stores TIMESTAMP WITHOUT TIME ZONE and
    # SQLAlchemy strips tzinfo on write), so a tz-aware "now" would make the
    # Python-side comparisons in _event_in_window raise "can't compare
    # offset-naive and offset-aware". Generated-at timestamps are also emitted
    # as naive ISO, which the frontend parses without trouble.
    return datetime.now(UTC).replace(tzinfo=None)


def _event_in_window(event: ThermalEvent, cutoff: datetime) -> bool:
    # Include the row when the acquisition date is unknown rather than hiding
    # it — the demo seed sets created_at but not always acq_date.
    if event.acq_date is None:
        return True
    return event.acq_date >= cutoff


def _dominant(ids: list, label_by_event: dict[str, str]) -> str:
    counts = Counter(label_by_event[i] for i in ids if i in label_by_event)
    if not counts:
        return "other"
    return counts.most_common(1)[0][0]


def _priority_score(
    detection_count: int, max_frp: float | None, dominant: str
) -> float:
    score = 0.0
    if max_frp is not None:
        score += min(max_frp / 200.0, 1.0) * 0.5
    score += min(detection_count / 10.0, 1.0) * 0.3
    if dominant == "industrial_fire":
        score += 0.2
    elif dominant == "persistent_thermal_source":
        score += 0.15
    return round(min(score, 1.0), 3)


async def get_density(
    db: AsyncSession,
    bbox: tuple[float, float, float, float] | None = None,
    cell_size: float = GRID_DEG,
):
    """Heatmap cells: event count + mean FRP + dominant class per grid cell."""
    from app.schemas.intelligence import DensityCell, DensityResponse

    w, s, e, n = bbox or INDIA_BBOX
    events = (await db.execute(select(ThermalEvent))).scalars().all()
    cls_rows = (
        await db.execute(select(Classification.event_id, Classification.label))
    ).all()
    label_by_event = {row[0]: row[1] for row in cls_rows}

    buckets: dict[tuple[int, int], dict] = defaultdict(
        lambda: {"count": 0, "frp_sum": 0.0, "frp_n": 0, "ids": []}
    )
    for ev in events:
        if not (w <= ev.longitude <= e and s <= ev.latitude <= n):
            continue
        key = (int(ev.longitude // cell_size), int(ev.latitude // cell_size))
        b = buckets[key]
        b["count"] += 1
        b["ids"].append(ev.id)
        if ev.frp is not None:
            b["frp_sum"] += ev.frp
            b["frp_n"] += 1

    cells = [
        DensityCell(
            lat=round((gy + 0.5) * cell_size, 5),
            lon=round((gx + 0.5) * cell_size, 5),
            count=b["count"],
            mean_frp=round(b["frp_sum"] / b["frp_n"], 2) if b["frp_n"] else None,
            dominant_class=_dominant(b["ids"], label_by_event),
        )
        for (gx, gy), b in sorted(buckets.items())
    ]
    return DensityResponse(
        bbox=list(bbox or INDIA_BBOX),
        cell_size_deg=cell_size,
        cells=cells,
        generated_at=_now(),
    )


async def get_persistent_sources(
    db: AsyncSession, window_days: int = WINDOW_DAYS
):
    """Recurring sources, clustered by grid and ranked by a simple score."""
    from app.schemas.intelligence import PersistentSource, PersistentSourcesResponse

    cutoff = _now() - timedelta(days=window_days)
    events = (
        await db.execute(select(ThermalEvent))
    ).scalars().all()
    events = [e for e in events if _event_in_window(e, cutoff)]
    sites = (await db.execute(select(IndustrialSite))).scalars().all()
    cls_rows = (
        await db.execute(select(Classification.event_id, Classification.label))
    ).all()
    label_by_event = {row[0]: row[1] for row in cls_rows}

    clusters: dict[tuple[int, int], list[ThermalEvent]] = defaultdict(list)
    for ev in events:
        key = (int(ev.longitude // GRID_DEG), int(ev.latitude // GRID_DEG))
        clusters[key].append(ev)

    sources: list[PersistentSource] = []
    for idx, (_, evs) in enumerate(
        sorted(clusters.items(), key=lambda kv: -len(kv[1])), start=1
    ):
        lats = [e.latitude for e in evs]
        lons = [e.longitude for e in evs]
        clat, clon = sum(lats) / len(lats), sum(lons) / len(lons)
        max_frp = max((e.frp for e in evs if e.frp is not None), default=None)
        brightnesses = [e.brightness for e in evs if e.brightness is not None]
        avg_brightness = (
            round(sum(brightnesses) / len(brightnesses), 1) if brightnesses else None
        )

        facility = None
        distance_km = None
        for site in sites:
            d = haversine_distance(clat, clon, site.latitude, site.longitude)
            if distance_km is None or d < distance_km:
                distance_km = d
                facility = site

        dominant = _dominant([e.id for e in evs], label_by_event)
        is_industrial = facility is not None and distance_km <= INDUSTRIAL_RADIUS_KM
        kind = (
            "industrial"
            if is_industrial
            else "wildfire"
            if dominant == "natural_wildfire"
            else "residue"
        )
        label = facility.name if is_industrial else f"Source {idx}"
        state = facility.state if facility else "Unknown"
        district = facility.district if facility else "Unknown"
        dates = [e.acq_date for e in evs if e.acq_date is not None]
        first_date = min(dates).date().isoformat() if dates else None
        last_date = max(dates).date().isoformat() if dates else None

        sources.append(
            PersistentSource(
                hotspot_id=idx,
                label=label,
                kind=kind,
                state=state,
                district=district,
                lat=round(clat, 5),
                lon=round(clon, 5),
                active_days=len({d.date() for d in dates}),
                detection_count=len(evs),
                dominant_class=dominant,
                max_frp=round(max_frp, 1) if max_frp is not None else None,
                avg_brightness=avg_brightness,
                priority_score=_priority_score(len(evs), max_frp, dominant),
                facility_name=facility.name if facility else None,
                facility_type=facility.industry_type if facility else None,
                distance_km=round(distance_km, 1) if distance_km is not None else None,
                first_date=first_date,
                last_date=last_date,
            )
        )

    return PersistentSourcesResponse(
        window_days=window_days, generated_at=_now(), sources=sources
    )


async def get_watchtower(db: AsyncSession, window_days: int = WINDOW_DAYS):
    """The monitoring digest: what changed, what to look at, what to review."""
    from app.schemas.intelligence import WatchtowerDigest

    cutoff = _now() - timedelta(days=window_days)
    events = (await db.execute(select(ThermalEvent))).scalars().all()
    recent = [e for e in events if _event_in_window(e, cutoff)]
    sites = (await db.execute(select(IndustrialSite))).scalars().all()

    new_events = len(recent)
    # Priority heuristic: high FRP or high FIRMS confidence.
    priority_events = sum(
        1
        for e in recent
        if (e.frp is not None and e.frp > 50) or e.confidence == "high"
    )
    requires_review = sum(1 for e in recent if e.frp is not None and e.frp > 100)

    cls_rows = (
        await db.execute(select(Classification.label))
    ).all()
    label_counts = Counter(r[0] for r in cls_rows)
    total_cls = sum(label_counts.values()) or 1
    by_class = [
        {
            "category": cat,
            "count": n,
            "percentage": round(n / total_cls * 100, 1),
        }
        for cat, n in label_counts.most_common()
    ]

    # Region = the state of the nearest industrial site; "Unknown" if none.
    region_counts: dict[str, int] = defaultdict(int)
    for e in recent:
        region = "Unknown"
        best = None
        for site in sites:
            d = haversine_distance(
                e.latitude, e.longitude, site.latitude, site.longitude
            )
            if best is None or d < best:
                best = d
                region = site.state or "Unknown"
        region_counts[region] += 1
    top_regions = [
        {"state": st, "count": c}
        for st, c in sorted(region_counts.items(), key=lambda kv: -kv[1])
    ]

    return WatchtowerDigest(
        generated_at=_now(),
        window_days=window_days,
        new_events=new_events,
        priority_events=priority_events,
        requires_review=requires_review,
        persistent_sources=len(recent),
        by_class=by_class,
        top_regions=top_regions,
    )


async def get_event_report(db: AsyncSession, event_id):
    """A structured, export-ready report for one event."""
    from app.schemas.intelligence import EventReportResponse
    from app.services.event_service import get_thermal_event

    event = await get_thermal_event(db, event_id)
    if event is None:
        return None

    classifications = await get_classifications_for_event(db, event_id)
    # Highest-confidence classification wins; absent -> unknown/other.
    classification = classifications[0] if classifications else None
    label = classification.label if classification else "other"
    confidence = classification.confidence if classification else 0.0

    confidence_band = (
        "high" if confidence >= 0.8 else "moderate" if confidence >= 0.5 else "uncertain"
    )
    priority_band = (
        "critical" if confidence >= 0.9 and (event.frp or 0) > 100
        else "high" if (event.frp or 0) > 50
        else "moderate" if (event.frp or 0) > 15
        else "low"
    )
    priority_score = round(
        min((event.frp or 0) / 200.0, 1.0) * 0.6 + confidence * 0.4, 3
    )

    evidence = await assemble_evidence(db, event_id)
    history = await get_historical_observations(db, event_id)
    sites = (await db.execute(select(IndustrialSite))).scalars().all()
    facility = None
    distance_km = None
    for site in sites:
        d = haversine_distance(
            event.latitude, event.longitude, site.latitude, site.longitude
        )
        if distance_km is None or d < distance_km:
            distance_km = d
            facility = site

    key_evidence = (
        [
            {
                "factor": c.component_type,
                "weight": c.weight,
                "detail": c.description,
                "source": "model" if c.component_type == "thermal_signature" else "satellite",
            }
            for c in evidence.components
        ]
        if evidence
        else []
    )

    return EventReportResponse(
        event_id=str(event.id),
        generated_at=_now(),
        classification=label,
        classification_label=label.replace("_", " "),
        confidence=confidence,
        confidence_band=confidence_band,
        priority_band=priority_band,
        priority_score=priority_score,
        location={
            "lat": event.latitude,
            "lng": event.longitude,
            "state": facility.state if facility else None,
            "district": facility.district if facility else None,
            "breadcrumb": [
                b for b in [event.satellite, event.instrument] if b
            ],
        },
        persistence={
            "active_days": len({h.get("acq_date") for h in history if h.get("acq_date")}),
            "detection_count": len(history),
            "window_days": WINDOW_DAYS,
        },
        thermal={
            "brightness": event.brightness or 0,
            "frp": event.frp,
            "satellite": event.satellite or "unknown",
            "instrument": event.instrument or "unknown",
            "daynight": event.daynight or "unknown",
        },
        nearest_facility=(
            {
                "name": facility.name,
                "type": facility.industry_type,
                "distance_km": round(distance_km, 1),
            }
            if facility and distance_km is not None
            else None
        ),
        key_evidence=key_evidence,
        caveats=[
            "Confidence is from the placeholder classifier, not the production model.",
            "Persistence is derived from in-window observations only.",
        ],
        provenance={
            "data_type": "satellite_thermal_anomaly",
            "primary_source": "NASA FIRMS",
            "satellites": event.satellite or "unknown",
            "model_version": classification.model_version if classification else "unclassified",
            "industrial_context": facility.name if facility else "no nearby facility",
        },
    )
