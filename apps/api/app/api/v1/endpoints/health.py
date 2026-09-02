"""
Health endpoints.

`/health` is the contract the frontend probes before it decides to use live data
(`probeBackend()` in `src/features/events/eventService.ts`). Its shape is
therefore load-bearing: **do not rename `status`, `service`, or `version`**
without changing the frontend at the same time.

Two endpoints, because they answer different questions and get called by
different things:

* ``GET /api/v1/health``   — liveness. "Is the process up?" Always 200. Cheap.
                             This is what a load balancer and the frontend call.
* ``GET /api/v1/health/ready`` — readiness. "Can we serve real requests?"
                             Returns 503 when PostgreSQL is unreachable.

Keeping them separate matters: if readiness were folded into liveness, a
database restart would mark every pod unhealthy and the orchestrator would kill
the very processes that were about to reconnect successfully.
"""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Response, status
from pydantic import BaseModel, Field

from app.core.config import Settings, get_settings
from app.core.database import check_database
from app.core.errors import error_response

router = APIRouter()

# Set once at import so uptime is measured from process start, not first call.
_STARTED_AT = time.time()


class HealthResponse(BaseModel):
    """Liveness payload. Field names are part of the frontend contract."""

    status: str = Field(description="Always the literal 'healthy' when 200.")
    service: str = Field(description="Short service identifier.")
    version: str = Field(description="API version string.")
    environment: str = Field(description="development | test | staging | production")
    uptime_seconds: float = Field(description="Seconds since the process started.")


class DependencyStatus(BaseModel):
    status: str = Field(description="'ok' or 'down'")
    detail: str | None = Field(default=None, description="Short failure reason.")


class ReadinessResponse(BaseModel):
    status: str = Field(description="'ready' or 'not_ready'")
    service: str
    version: str
    environment: str
    uptime_seconds: float
    checks: dict[str, DependencyStatus] = Field(
        default_factory=dict, description="One entry per dependency we poll."
    )


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness probe",
    tags=["health"],
)
async def health_check() -> HealthResponse:
    """
    Is the process alive?

    Deliberately does not touch the database. A pod that is up but has a
    temporarily unreachable database is still up, and saying otherwise causes
    restart loops.
    """
    settings: Settings = get_settings()
    return HealthResponse(
        status="healthy",
        service="sih26162-thermal-api",
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        uptime_seconds=round(time.time() - _STARTED_AT, 3),
    )


@router.get(
    "/health/ready",
    response_model=ReadinessResponse,
    responses={503: {"description": "A required dependency is unreachable."}},
    summary="Readiness probe",
    tags=["health"],
)
async def readiness_check(response: Response) -> Any:
    """
    Can we serve real traffic?

    Polls PostgreSQL. Returns 503 (in the standard error envelope) when it is
    down, so a readiness probe in Kubernetes/Docker stops sending traffic here
    without restarting the process.
    """
    settings: Settings = get_settings()
    uptime = round(time.time() - _STARTED_AT, 3)

    db_ok, db_detail = await check_database()
    checks = {
        "database": DependencyStatus(
            status="ok" if db_ok else "down",
            detail=db_detail,
        )
    }

    if not db_ok:
        return error_response(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "SERVICE_UNAVAILABLE",
            "Database is unreachable.",
            details={"checks": {k: v.model_dump() for k, v in checks.items()}},
        )

    return ReadinessResponse(
        status="ready",
        service="sih26162-thermal-api",
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        uptime_seconds=uptime,
        checks=checks,
    )
