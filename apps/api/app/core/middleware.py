"""
HTTP middleware: request ids, structured access logs, and baseline hardening.

Three responsibilities, deliberately kept in one file because they are all
per-request plumbing and are registered together:

1. ``RequestContextMiddleware`` — assigns/propagates ``X-Request-ID``, binds it
   to the logging context, and emits one access log line with timing.
2. ``SecurityHeadersMiddleware`` — the cheap, no-downside response headers.
3. ``BodySizeLimitMiddleware`` — rejects absurdly large payloads before they
   reach a parser.

What is deliberately NOT here: authentication and rate limiting. Auth waits for
a decision on who the users are (see docs/backend/SECURITY.md). Rate limiting
needs Redis to work across more than one worker, and adding an in-process
limiter now would be a thing to rip out later. Both boundaries are documented
rather than half-built.
"""

from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from app.core.config import Settings
from app.core.logging import RequestContextFilter, request_id_var

REQUEST_ID_HEADER = "X-Request-ID"

# Endpoints excluded from the access log. Health checks are polled constantly
# and would otherwise bury every line worth reading.
_QUIET_PATHS = frozenset(
    {"/api/v1/health", "/", "/docs", "/redoc", "/openapi.json", "/favicon.ico"}
)

logger = logging.getLogger("api.request")

# Paths that may legitimately carry a large body (future CSV/shapefile upload).
_LARGE_BODY_PATH_PREFIXES: tuple[str, ...] = ()


def _new_request_id() -> str:
    return uuid.uuid4().hex


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Give every request an id, and make that id reachable from any log line.

    The id is:
      * taken from the incoming ``X-Request-ID`` if one was sent (dev only),
      * generated otherwise,
      * stored in a contextvar so ``logging`` can attach it automatically,
      * returned on the response so the browser can show it in an error toast.

    That last part is the useful one. When someone reports a failure, the id in
    the UI is the exact key for the log line.
    """

    def __init__(self, app: ASGIApp, settings: Settings) -> None:
        super().__init__(app)
        self.settings = settings

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        incoming = request.headers.get(REQUEST_ID_HEADER)
        # Only trust a client-supplied id outside production; otherwise an
        # attacker controls our log correlation keys.
        request_id = (
            incoming
            if incoming and not self.settings.is_production and _looks_like_id(incoming)
            else _new_request_id()
        )

        token = request_id_var.set(request_id)
        request.scope["request_id"] = request_id
        # The exception handlers in core/errors.py log through this.
        request.scope["logger"] = logger

        started = time.perf_counter()
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception:
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            # The exception handlers format the body; here we only add the log
            # line. Re-raise so Starlette's error machinery still runs.
            logger.exception(
                "%s %s failed after %.2fms",
                request.method,
                request.url.path,
                duration_ms,
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                    "status_code": 500,
                },
            )
            raise
        else:
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            response.headers[REQUEST_ID_HEADER] = request_id

            if request.url.path not in _QUIET_PATHS:
                log = logger.warning if status_code >= 500 else logger.info
                log(
                    "%s %s -> %s (%.2fms)",
                    request.method,
                    request.url.path,
                    status_code,
                    duration_ms,
                    extra={
                        "method": request.method,
                        "path": request.url.path,
                        "status_code": status_code,
                        "duration_ms": duration_ms,
                    },
                )
            return response
        finally:
            # Reset so a pooled worker does not leak this id into the next
            # request it handles.
            request_id_var.reset(token)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Static response headers. Cheap, no behaviour change, no configuration.

    ``Content-Security-Policy`` is intentionally absent: this API returns JSON
    and is never rendered as a document, so a CSP would only add a header to
    maintain. Add one if we ever serve HTML from this service.
    """

    BASE_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    }

    def __init__(self, app: ASGIApp, settings: Settings) -> None:
        super().__init__(app)
        self.headers = dict(self.BASE_HEADERS)
        if settings.is_production:
            self.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains"
            )

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        for key, value in self.headers.items():
            response.headers.setdefault(key, value)
        return response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Reject request bodies over a limit before they are read into memory.

    This is a read-only API today, so the default limit is small. Raise
    ``MAX_BODY_BYTES`` (or add a path prefix above) when ingestion lands.
    """

    def __init__(self, app: ASGIApp, settings: Settings) -> None:
        super().__init__(app)
        self.limit = settings.MAX_BODY_BYTES

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if self.limit <= 0:
            return await call_next(request)

        if any(request.url.path.startswith(p) for p in _LARGE_BODY_PATH_PREFIXES):
            return await call_next(request)

        declared = request.headers.get("content-length")
        if declared is not None:
            try:
                if int(declared) > self.limit:
                    from app.core.errors import error_response

                    return error_response(
                        413,
                        "PAYLOAD_TOO_LARGE",
                        f"Request body exceeds {self.limit} bytes.",
                    )
            except ValueError:
                # Malformed Content-Length. Let Starlette deal with it.
                pass

        return await call_next(request)


def _looks_like_id(value: str) -> bool:
    """Guard against log injection through a client-supplied request id."""
    return 0 < len(value) <= 64 and all(c.isalnum() or c in "-_." for c in value)


def install_logging_filter() -> None:
    """
    Attach the request-id filter to the loggers that emit our lines.

    Called once from ``create_app()``. The formatters fall back to the
    contextvar anyway, but adding the filter means ``request_id`` is present on
    records even when they are emitted by a handler that never touched it.
    """
    for name in ("api", "app", "uvicorn.error"):
        target = logging.getLogger(name)
        if not any(isinstance(f, RequestContextFilter) for f in target.filters):
            target.addFilter(RequestContextFilter())
