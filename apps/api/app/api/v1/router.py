from fastapi import APIRouter

from app.api.v1.endpoints.admin import router as admin_router
from app.api.v1.endpoints.analytics import router as analytics_router
from app.api.v1.endpoints.events import router as events_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.intelligence import router as intelligence_router

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(health_router, tags=["health"])
v1_router.include_router(events_router, prefix="/events", tags=["events"])
v1_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
v1_router.include_router(
    intelligence_router, tags=["intelligence"]
)
# /admin is intentionally last and development-only (see admin.py).
v1_router.include_router(admin_router, prefix="/admin", tags=["admin"])
