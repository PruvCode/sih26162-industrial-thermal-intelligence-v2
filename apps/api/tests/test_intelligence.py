import pytest
from httpx import AsyncClient

UNKNOWN_ID = "00000000-0000-0000-0000-000000000000"


@pytest.mark.asyncio
async def test_seed_populates_demo_data(client: AsyncClient):
    response = await client.post("/api/v1/admin/seed")
    assert response.status_code == 200
    body = response.json()
    # The demo seed inserts 8 events and classifies all 8.
    assert body["events_seeded"] == 8
    assert body["classifications_seeded"] == 8
    assert body["total_events"] == 8

    # Seeding is idempotent: a second call is a no-op.
    again = await client.post("/api/v1/admin/seed")
    assert again.json()["events_seeded"] == 0


@pytest.mark.asyncio
async def test_persistent_sources_after_seed(client: AsyncClient):
    await client.post("/api/v1/admin/seed")
    # window_days=365 so the assertion is stable no matter when the suite runs
    # (the demo rows are dated Aug 2026).
    response = await client.get(
        "/api/v1/persistent-sources", params={"window_days": 365}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["window_days"] == 365
    # All eight demo events land in distinct grid cells.
    assert len(data["sources"]) == 8
    # Fields the frontend consumes.
    src = data["sources"][0]
    assert {"hotspot_id", "lat", "lon", "detection_count", "dominant_class"} <= src.keys()
    assert src["dominant_class"] in {
        "industrial_fire",
        "persistent_thermal_source",
        "natural_wildfire",
        "other",
    }


@pytest.mark.asyncio
async def test_density_returns_cells(client: AsyncClient):
    await client.post("/api/v1/admin/seed")
    response = await client.get("/api/v1/analytics/density")
    assert response.status_code == 200
    data = response.json()
    assert len(data["cells"]) >= 1
    assert data["bbox"] == [68.0, 8.0, 98.0, 37.0]
    for cell in data["cells"]:
        assert cell["count"] >= 1
        assert -90 <= cell["lat"] <= 90
        assert -180 <= cell["lon"] <= 180


@pytest.mark.asyncio
async def test_density_bad_bbox_is_400(client: AsyncClient):
    response = await client.get(
        "/api/v1/analytics/density", params={"bbox": "1,2,3"}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "BAD_REQUEST"


@pytest.mark.asyncio
async def test_watchtower_after_seed(client: AsyncClient):
    await client.post("/api/v1/admin/seed")
    # window_days=365 so the count is stable regardless of run date.
    response = await client.get("/api/v1/watchtower", params={"window_days": 365})
    assert response.status_code == 200
    data = response.json()
    assert data["new_events"] == 8
    assert "by_class" in data
    assert "top_regions" in data


@pytest.mark.asyncio
async def test_event_report_present(client: AsyncClient):
    await client.post("/api/v1/admin/seed")
    event_id = (await client.get("/api/v1/events")).json()["items"][0]["id"]
    response = await client.get(f"/api/v1/events/{event_id}/report")
    assert response.status_code == 200
    report = response.json()
    assert report["event_id"] == event_id
    assert report["classification"] in {
        "industrial_fire",
        "persistent_thermal_source",
        "natural_wildfire",
        "other",
    }
    assert 0.0 <= report["confidence"] <= 1.0
    assert "key_evidence" in report
    assert "provenance" in report


@pytest.mark.asyncio
async def test_event_report_unknown_is_404(client: AsyncClient):
    response = await client.get(f"/api/v1/events/{UNKNOWN_ID}/report")
    assert response.status_code == 404
