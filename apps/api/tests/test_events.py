import pytest
from httpx import AsyncClient

from app.services.classification_service import LABELS, MODEL_VERSION

# Demo seed in app/services/event_service.seed_mock_events inserts exactly this
# many rows.
SEED_COUNT = 8
UNKNOWN_ID = "00000000-0000-0000-0000-000000000000"


# --- empty database -------------------------------------------------------

@pytest.mark.asyncio
async def test_list_events_empty(client: AsyncClient):
    response = await client.get("/api/v1/events")
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0
    assert data["page"] == 1


@pytest.mark.asyncio
async def test_get_event_not_found(client: AsyncClient):
    response = await client.get(f"/api/v1/events/{UNKNOWN_ID}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_history_404(client: AsyncClient):
    response = await client.get(f"/api/v1/events/{UNKNOWN_ID}/history")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_evidence_404(client: AsyncClient):
    response = await client.get(f"/api/v1/events/{UNKNOWN_ID}/evidence")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_not_found_uses_error_envelope(client: AsyncClient):
    response = await client.get(f"/api/v1/events/{UNKNOWN_ID}")
    assert response.status_code == 404
    body = response.json()
    # The shape every non-2xx response must have — the frontend parses it.
    assert body["success"] is False
    assert body["error"]["code"] == "NOT_FOUND"
    assert "message" in body["error"]
    assert "request_id" in body


# --- seeded database ------------------------------------------------------

@pytest.mark.asyncio
async def test_list_returns_seeded_rows(seeded_client: AsyncClient):
    response = await seeded_client.get("/api/v1/events")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == SEED_COUNT
    assert len(data["items"]) == SEED_COUNT
    # The flat coordinate fields the frontend expects, not a GeoJSON blob.
    first = data["items"][0]
    assert {"id", "latitude", "longitude", "frp", "confidence"} <= first.keys()


@pytest.mark.asyncio
async def test_bbox_filter_excludes_outside(seeded_client: AsyncClient):
    # Exactly one seed event (22.30, 70.80) falls inside this box.
    response = await seeded_client.get(
        "/api/v1/events",
        params={"lat_min": 22.0, "lat_max": 23.0, "lon_min": 70.0, "lon_max": 71.0},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    point = data["items"][0]
    assert 22.0 <= point["latitude"] <= 23.0
    assert 70.0 <= point["longitude"] <= 71.0


@pytest.mark.asyncio
async def test_pagination_maths(seeded_client: AsyncClient):
    response = await seeded_client.get(
        "/api/v1/events", params={"page": 2, "page_size": 3}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 2
    assert data["page_size"] == 3
    assert len(data["items"]) == 3
    # ceil(8 / 3) == 3
    assert data["pages"] == 3


@pytest.mark.asyncio
async def test_date_filter_inclusive(seeded_client: AsyncClient):
    # acq_date >= 2026-08-03 covers 4 of the 8 seed events.
    response = await seeded_client.get(
        "/api/v1/events", params={"date_from": "2026-08-03"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 4


@pytest.mark.asyncio
async def test_invalid_date_is_a_validation_error(seeded_client: AsyncClient):
    # A malformed date must be a 422 with the offending field named — NOT a 500.
    response = await seeded_client.get(
        "/api/v1/events", params={"date_from": "not-a-date"}
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["details"]["fields"][0]["field"] == "date_from"


@pytest.mark.asyncio
async def test_analytics_counts_seeded_events(seeded_client: AsyncClient):
    response = await seeded_client.get("/api/v1/analytics/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_events"] == SEED_COUNT
    # The demo seed inserts no industrial sites.
    assert data["total_sites"] == 0
    # One 7-day time series, exactly 7 buckets, summing to the seeded total.
    assert len(data["time_series"]["points"]) == 7
    assert sum(p["count"] for p in data["time_series"]["points"]) == SEED_COUNT


# --- classification -------------------------------------------------------

@pytest.mark.asyncio
async def test_classify_creates_then_replays(seeded_client: AsyncClient):
    event = seeded_client  # alias for readability
    list_resp = await event.get("/api/v1/events")
    event_id = list_resp.json()["items"][0]["id"]

    first = await event.post(f"/api/v1/events/{event_id}/classify")
    assert first.status_code == 201
    first_body = first.json()
    assert first_body["label"] in LABELS
    assert 0.0 <= first_body["confidence"] <= 1.0
    assert first_body["model_version"] == MODEL_VERSION

    # Re-playing without force returns the existing row (200), not a new one.
    second = await event.post(f"/api/v1/events/{event_id}/classify")
    assert second.status_code == 200
    assert second.json()["id"] == first_body["id"]
    assert second.json()["label"] == first_body["label"]


@pytest.mark.asyncio
async def test_classify_is_deterministic(seeded_client: AsyncClient):
    event_id = (await seeded_client.get("/api/v1/events")).json()["items"][0]["id"]
    a = await seeded_client.post(f"/api/v1/events/{event_id}/classify")
    b = await seeded_client.post(f"/api/v1/events/{event_id}/classify?force=true")
    # Same event id -> same label/confidence every time, no matter the row.
    assert a.json()["label"] == b.json()["label"]
    assert a.json()["confidence"] == b.json()["confidence"]
    # ...but the forced re-run wrote a fresh row.
    assert a.json()["id"] != b.json()["id"]


@pytest.mark.asyncio
async def test_classify_unknown_event_404(seeded_client: AsyncClient):
    response = await seeded_client.post(f"/api/v1/events/{UNKNOWN_ID}/classify")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_evidence_reflects_classification(seeded_client: AsyncClient):
    event_id = (await seeded_client.get("/api/v1/events")).json()["items"][0]["id"]

    # Before classification the evidence reports "unknown".
    before = await seeded_client.get(f"/api/v1/events/{event_id}/evidence")
    assert before.status_code == 200
    assert before.json()["classification_label"] == "unknown"

    # After classifying, evidence uses the same label.
    await seeded_client.post(f"/api/v1/events/{event_id}/classify")
    after = await seeded_client.get(f"/api/v1/events/{event_id}/evidence")
    assert after.json()["classification_label"] in LABELS
