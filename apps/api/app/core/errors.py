"""
One error shape for every failure the API returns.

The frontend has a single error model (`src/lib/api/errors.ts`). It can already
read three bodies that FastAPI produces by default, so it would technically work
without this file. It works *better* with it, because the default bodies carry
no machine-readable code:

    FastAPI default  -> { "detail": "Event not found" }
    With this module -> { "success": false,
                          "error": { "code": "EVENT_NOT_FOUND",
                                     "message": "Event not found",
                                     "details": {...} } }

The second one lets the UI branch on `error.code` instead of substring-matching
a sentence. That is the difference between "show an empty state" and "show an
error toast", which is a real product decision we should not be making with
`if "not found" in message`.

`message` is developer-facing. It is not sanitised beyond stripping exception
text in production — see `AppError.__init__`.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import Settings
from app.core.logging import get_request_id, redact_mapping


class ErrorBody(BaseModel):
    """The `error` object inside the envelope."""

    code: str = Field(description="Stable machine-readable code, e.g. EVENT_NOT_FOUND.")
    message: str = Field(description="Human-readable explanation. Safe to log.")
    details: Any | None = Field(
        default=None,
        description="Structured extras — validation failures, field names, upstream status.",
    )


class ErrorEnvelope(BaseModel):
    """Every non-2xx response from this API has this shape."""

    success: bool = False
    error: ErrorBody
    request_id: str = Field(default="-", description="Echo of X-Request-ID, for support.")


# ---------------------------------------------------------------------------
# Application errors
# ---------------------------------------------------------------------------


class AppError(Exception):
    """
    Base class for expected, business-level failures.

    Raise this (or a subclass) anywhere in the service layer. It is converted to
    the envelope automatically; no endpoint has to catch it.

        raise NotFoundError("Event not found", details={"event_id": str(event_id)})
    """

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    code: str = "INTERNAL_ERROR"

    def __init__(
        self,
        message: str = "An unexpected error occurred.",
        *,
        details: Any | None = None,
        status_code: int | None = None,
        code: str | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.details = details
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code


class BadRequestError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "BAD_REQUEST"


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "UNAUTHORIZED"


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "FORBIDDEN"


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"


class RateLimitedError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "RATE_LIMITED"


class UpstreamError(AppError):
    """
    A dependency we call failed — NASA FIRMS, the ML service, PostGIS.

    Mapped to 503 because from the client's point of view the feature is
    temporarily unavailable, not broken.
    """

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "UPSTREAM_UNAVAILABLE"


class NotReadyError(AppError):
    """
    The endpoint is scaffolded in the router but not implemented yet.

    Returning 501 is honest. Returning a fabricated 200 is how a demo ends up
    shipping seeded numbers under a "live data" badge.
    """

    status_code = status.HTTP_501_NOT_IMPLEMENTED
    code = "NOT_IMPLEMENTED"


# ---------------------------------------------------------------------------
# Envelope helpers
# ---------------------------------------------------------------------------


def error_response(
    status_code: int,
    code: str,
    message: str,
    *,
    details: Any | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body = ErrorEnvelope(
        success=False,
        error=ErrorBody(code=code, message=message, details=details),
        request_id=get_request_id(),
    )
    response = JSONResponse(
        status_code=status_code,
        content=body.model_dump(mode="json"),
        headers=headers,
    )
    # The frontend reads this header first when it has no body to parse.
    response.headers["X-Request-ID"] = body.request_id
    return response


def _status_to_code(status_code: int) -> str:
    return {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        413: "PAYLOAD_TOO_LARGE",
        422: "UNPROCESSABLE_ENTITY",
        429: "RATE_LIMITED",
        500: "INTERNAL_ERROR",
        501: "NOT_IMPLEMENTED",
        502: "BAD_GATEWAY",
        503: "SERVICE_UNAVAILABLE",
        504: "GATEWAY_TIMEOUT",
    }.get(status_code, "INTERNAL_ERROR" if status_code >= 500 else "BAD_REQUEST")


def _logger_for(request: Request) -> logging.Logger:
    """
    The per-request logger set by the middleware, with a safe fallback.

    An exception raised outside our middleware stack (or during startup) has no
    ``logger`` in its scope. Falling back to a module logger keeps the handler
    from raising ``KeyError`` while it is trying to report a failure.
    """
    scoped = request.scope.get("logger")
    return scoped if isinstance(scoped, logging.Logger) else logging.getLogger("api.error")


def _safe_message(exc: Exception, settings: Settings) -> str:
    """
    What we tell the client about an unexpected failure.

    In development the real exception text is genuinely useful and the data is
    fake anyway. In production it is information disclosure — connection
    strings, file paths, table names — so we return a generic sentence and the
    detail goes to the log instead.
    """
    if settings.is_production:
        return "An internal error occurred."
    return str(exc) or exc.__class__.__name__


# ---------------------------------------------------------------------------
# Handler registration
# ---------------------------------------------------------------------------


def register_exception_handlers(app: FastAPI, settings: Settings) -> None:
    """
    Install handlers for our own errors and for the ones FastAPI raises itself.

    Order matters only in that `AppError` is not an `HTTPException`; Starlette
    would otherwise let it escape as a 500 with a traceback in the logs and no
    body at all.
    """

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        # Expected failures are logged at WARNING: nobody paged, but it is a
        # real answer to a real request and worth counting.
        _logger_for(request).warning(
            "%s: %s", exc.code, exc.message, extra={"error_code": exc.code}
        )
        return error_response(exc.status_code, exc.code, exc.message, details=exc.details)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        # `detail` may be a dict (FastAPI allows it) — then it is structured
        # detail, not the message.
        detail = exc.detail
        if isinstance(detail, dict):
            message = str(detail.get("message", "Request failed"))
            details = detail.get("details")
        else:
            message = str(detail)
            details = None

        logger = _logger_for(request)
        if exc.status_code >= 500:
            logger.error("HTTP %s: %s", exc.status_code, message)
        else:
            logger.info("HTTP %s: %s", exc.status_code, message)

        return error_response(
            exc.status_code,
            _status_to_code(exc.status_code),
            message,
            details=details,
            headers=exc.headers,
        )

    @app.exception_handler(HTTPException)
    async def handle_fastapi_http_exception(
        request: Request, exc: HTTPException
    ) -> JSONResponse:
        # HTTPException subclasses StarletteHTTPException, but registering both
        # keeps the intent explicit and future-proof if FastAPI changes layering.
        return await handle_http_exception(request, exc)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """
        Turn pydantic's error list into something a form can render.

        Raw FastAPI output is `[{loc: ['query','page'], msg: '...', type: ...}]`,
        where `loc[0]` is the request part. The frontend only needs the field
        path, so we flatten to `{"field": "page", "message": "...", "type": ...}`.
        """
        fields: list[dict[str, Any]] = []
        for error in exc.errors():
            loc = list(error.get("loc", []))
            # Drop the leading "query" / "body" / "path" segment.
            field = ".".join(str(p) for p in loc[1:] if p != "") or (str(loc[0]) if loc else "")
            fields.append(
                {
                    "field": field,
                    "message": error.get("msg", "Invalid value"),
                    "type": error.get("type", "value_error"),
                }
            )

        first_field = fields[0]["field"] if fields else ""
        first_message = fields[0]["message"] if fields else "Validation failed"

        _logger_for(request).info(
            "Validation failed on %s %s: %d field error(s)",
            request.method,
            request.url.path,
            len(fields),
            extra={"validation_errors": len(fields)},
        )

        return error_response(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "VALIDATION_ERROR",
            f"{first_field}: {first_message}" if first_field else first_message,
            details={"fields": fields},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        """
        Last resort. Log everything we know, tell the client nothing useful.
        """
        logger = _logger_for(request)
        logger.exception(
            "Unhandled exception on %s %s: %s",
            request.method,
            request.url.path,
            exc,
            extra={
                "path": request.url.path,
                "method": request.method,
                "query": redact_mapping(dict(request.query_params)),
            },
        )
        return error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            _safe_message(exc, settings),
        )
