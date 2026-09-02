from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.classification import Classification
from app.models.industrial_site import IndustrialSite
from app.models.thermal_event import ThermalEvent
from app.schemas.analytics import (
    AnalyticsSummary,
    CategoryBreakdown,
    TimeSeriesData,
    TimeSeriesPoint,
)


async def get_analytics_summary(db: AsyncSession) -> AnalyticsSummary:
    now = datetime.now(UTC)
    one_day_ago = now - timedelta(days=1)
    seven_days_ago = now - timedelta(days=7)

    total_events = (await db.execute(select(func.count()).select_from(ThermalEvent))).scalar() or 0
    total_sites = (await db.execute(select(func.count()).select_from(IndustrialSite))).scalar() or 0

    avg_frp = (
        await db.execute(select(func.avg(ThermalEvent.frp)))
    ).scalar_one_or_none()
    max_frp = (
        await db.execute(select(func.max(ThermalEvent.frp)))
    ).scalar_one_or_none()

    events_24h = (
        await db.execute(
            select(func.count())
            .select_from(ThermalEvent)
            .where(ThermalEvent.created_at >= one_day_ago)
        )
    ).scalar() or 0

    events_7d = (
        await db.execute(
            select(func.count())
            .select_from(ThermalEvent)
            .where(ThermalEvent.created_at >= seven_days_ago)
        )
    ).scalar() or 0

    high_risk = (
        await db.execute(
            select(func.count())
            .select_from(Classification)
            .where(Classification.confidence >= 0.8)
        )
    ).scalar() or 0

    classification_rows = (
        await db.execute(
            select(Classification.label, func.count(Classification.id))
            .group_by(Classification.label)
        )
    ).all()
    total_classified = sum(r[1] for r in classification_rows) or 1
    classification_breakdown = [
        CategoryBreakdown(
            category=r[0],
            count=r[1],
            percentage=round(r[1] / total_classified * 100, 1),
        )
        for r in classification_rows
    ]

    # The trailing 7 days, in ONE grouped query.
    #
    # The obvious way to write this is a `for i in range(7)` loop that runs a
    # COUNT and an AVG per day — 14 database round-trips to render one chart.
    # Grouping by day gets the same answer in a single round-trip, and the
    # server does the arithmetic it is good at.
    series_start = now - timedelta(days=6)
    series_rows = (
        await db.execute(
            select(
                func.date(ThermalEvent.created_at).label("day"),
                func.count(ThermalEvent.id).label("day_count"),
                func.avg(ThermalEvent.frp).label("avg_frp"),
            )
            .where(ThermalEvent.created_at >= series_start)
            .group_by(func.date(ThermalEvent.created_at))
        )
    ).all()

    # Read rows positionally: SQLAlchemy's Row is a namedtuple, so a column
    # labelled "count" would be shadowed by tuple.count() if we used row.count.
    series_by_day: dict[str, tuple[int, float | None]] = {}
    for row in series_rows:
        day_key = str(row[0]) if row[0] is not None else ""
        series_by_day[day_key] = (row[1] or 0, row[2])

    time_series_points = []
    for i in range(7):
        day_start = now - timedelta(days=6 - i)
        key = day_start.strftime("%Y-%m-%d")
        # Days with no events are absent from the GROUP BY result, but the
        # chart still needs a zero point for them.
        day_count, day_avg_frp = series_by_day.get(key, (0, None))
        time_series_points.append(
            TimeSeriesPoint(
                date=key,
                count=day_count,
                avg_frp=round(day_avg_frp, 2) if day_avg_frp else None,
            )
        )

    top_hotspots_result = await db.execute(
        select(ThermalEvent)
        .where(ThermalEvent.frp.isnot(None))
        .order_by(ThermalEvent.frp.desc())
        .limit(5)
    )
    top_hotspots = [
        {
            "id": str(e.id),
            "latitude": e.latitude,
            "longitude": e.longitude,
            "frp": e.frp,
            "brightness": e.brightness,
            "satellite": e.satellite,
        }
        for e in top_hotspots_result.scalars().all()
    ]

    return AnalyticsSummary(
        total_events=total_events,
        total_sites=total_sites,
        high_risk_events=high_risk,
        avg_frp=round(avg_frp, 2) if avg_frp else None,
        max_frp=round(max_frp, 2) if max_frp else None,
        events_last_24h=events_24h,
        events_last_7d=events_7d,
        classification_breakdown=classification_breakdown,
        time_series=TimeSeriesData(points=time_series_points, interval="daily"),
        top_hotspots=top_hotspots,
    )
