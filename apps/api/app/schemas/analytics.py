from pydantic import BaseModel, Field


class CategoryBreakdown(BaseModel):
    category: str
    count: int
    percentage: float = Field(..., ge=0.0, le=100.0)


class TimeSeriesPoint(BaseModel):
    date: str
    count: int
    avg_frp: float | None = None


class TimeSeriesData(BaseModel):
    points: list[TimeSeriesPoint]
    interval: str = "daily"


class AnalyticsSummary(BaseModel):
    total_events: int
    total_sites: int
    high_risk_events: int
    avg_frp: float | None = None
    max_frp: float | None = None
    events_last_24h: int
    events_last_7d: int
    classification_breakdown: list[CategoryBreakdown]
    time_series: TimeSeriesData
    top_hotspots: list[dict]
