"""
Application factory.

Everything is wired in ``create_app()`` rather than at import time so tests can
build an app with different settings, and so importing this module has no side
effects beyond defining things.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import v1_router
from app.core.config import Settings, get_settings
from app.core.database import dispose_engine
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import (
    BodySizeLimitMiddleware,
    RequestContextMiddleware,
    SecurityHeadersMiddleware,
    install_logging_filter,
)

logger = logging.getLogger("api.startup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup/shutdown work.

    Startup intentionally does NOT connect to PostgreSQL. A service that
    refuses to boot because the database is briefly unreachable is a service
    that cannot serve /health, which is exactly when you need /health. DB
    readiness is reported by the health endpoint instead (see
    docs/backend/API_CONTRACT.md).
    """
    settings: Settings = app.state.settings
    logger.info(
        "%s v%s starting (environment=%s)",
        settings.APP_NAME,
        settings.APP_VERSION,
        settings.ENVIRONMENT,
    )
    if settings.is_development:
        logger.debug("Effective settings: %s", settings.safe_dict())

    yield

    await dispose_engine()
    logger.info("Shutdown complete — database engine disposed.")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    # Logging first: anything that fails during setup must be visible.
    configure_logging(settings)
    install_logging_filter()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "Backend for AI-based detection and classification of industrial "
            "fires and persistent thermal sources from satellite data."
        ),
        # Swagger is a development convenience. In production it is off unless
        # somebody deliberately turns it back on.
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url="/redoc" if settings.docs_enabled else None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
        lifespan=lifespan,
    )
    app.state.settings = settings

    # --- Middleware -------------------------------------------------------
    # Starlette applies middleware in reverse order of registration: the LAST
    # one added is the OUTERMOST layer. Order below is therefore "closest to
    # the route" first, "first thing a request hits" last.
    if settings.TRUST_PROXY_HEADERS:
        # Behind nginx/ALB, so X-Forwarded-For is the real client IP.
        from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

        app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

    app.add_middleware(BodySizeLimitMiddleware, settings=settings)
    app.add_middleware(SecurityHeadersMiddleware, settings=settings)
    # Request id + access log must wrap everything route-related.
    app.add_middleware(RequestContextMiddleware, settings=settings)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
        expose_headers=["X-Request-ID"],
    )

    # --- Errors ------------------------------------------------------------
    register_exception_handlers(app, settings)

    # --- Routes ------------------------------------------------------------
    app.include_router(v1_router)

    @app.get("/", tags=["root"], summary="Service identity")
    async def root() -> dict[str, str]:
        return {
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
            "api": "/api/v1",
            "docs": "/docs" if settings.docs_enabled else "(disabled)",
        }

    return app


app = create_app()
