"""
Structured logging for the API.

Two formats, chosen with the LOG_FORMAT setting:

* ``console`` (default in development) — one human-readable line per event.
* ``json`` (default in production) — one JSON object per event, so logs can be
  shipped to Loki / CloudWatch / Datadog without a parsing rule.

Both formats always carry the ``request_id`` when the event happened inside a
request, which is the whole point: a user reports "it failed", they give us the
id from the error toast, and we can pull the exact request out of the logs.

Nothing here is clever on purpose. It is a logging config, not a framework.
"""

from __future__ import annotations

import contextvars
import json
import logging
import sys
import time
from typing import Any

from app.core.config import Settings

# The id of the request currently being handled, or "-" outside a request.
# Contextvars (not thread-locals) because FastAPI runs handlers in a thread pool
# or an event loop, and a request can await across both.
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default="-"
)


def get_request_id() -> str:
    return request_id_var.get()


def set_request_id(value: str) -> None:
    request_id_var.set(value)


# Query-string keys and header names whose values must never be logged.
_REDACT_HEADERS = frozenset(
    {
        "authorization",
        "cookie",
        "set-cookie",
        "x-api-key",
        "proxy-authorization",
    }
)

# Substrings that make a *value* suspicious (we log the key, never the value).
_SECRET_HINTS = ("password", "passwd", "secret", "token", "api_key", "apikey", "dsn")


def redact_mapping(values: dict[str, Any]) -> dict[str, Any]:
    """
    Copy a mapping, replacing anything that looks like a credential.

    A DATABASE_URL such as
    ``postgresql+asyncpg://sih_user:sih_password@localhost:5432/sih_thermal``
    contains a password, and it will end up in a startup log line the moment
    someone adds ``logger.info(settings.DATABASE_URL)``. Redact at the sink
    instead of trusting every future call site.
    """
    out: dict[str, Any] = {}
    for key, value in values.items():
        lowered = str(key).lower()
        if lowered in _REDACT_HEADERS or any(h in lowered for h in _SECRET_HINTS):
            out[key] = "***redacted***"
        else:
            out[key] = value
    return out


class JsonFormatter(logging.Formatter):
    """Emit one JSON object per record. Unknown/missing fields are omitted."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", get_request_id()),
        }

        # Anything passed via logger.info("...", extra={"event_id": ...}).
        for key, value in record.__dict__.items():
            if key.startswith("_") or key in _RESERVED:
                continue
            if key in payload:
                continue
            try:
                json.dumps(value)  # only keep fields that are serialisable
            except (TypeError, ValueError):
                value = repr(value)
            payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        try:
            return json.dumps(payload, default=str)
        except (TypeError, ValueError):
            return json.dumps({"message": record.getMessage(), "level": record.levelname})


# Attributes owned by logging.LogRecord that must not be copied into the payload.
_RESERVED = frozenset(
    set(logging.LogRecord("", 0, "", 0, "", None, None).__dict__.keys())
    | {
        "message",
        "asctime",
        "taskName",
        "stack_info",
        "exc_text",
        "exc_info",
        "args",
        "msg",
        "levelno",
        "levelname",
        "name",
        "pathname",
        "filename",
        "module",
        "lineno",
        "funcName",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "process",
        "processName",
    }
)


class ConsoleFormatter(logging.Formatter):
    """Human-readable single line. The only format used during development."""

    _LEVEL_COLOURS = {
        "DEBUG": "\033[36m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[35m",
    }
    _RESET = "\033[0m"

    def __init__(self, use_colour: bool = True) -> None:
        super().__init__(fmt="%(asctime)s %(levelname)-8s %(name)s: %(message)s")
        self.use_colour = use_colour

    def format(self, record: logging.LogRecord) -> str:
        text = super().format(record)
        rid = getattr(record, "request_id", None) or get_request_id()
        if rid and rid != "-":
            text = f"{text} [request_id={rid}]"
        if record.exc_info:
            text = f"{text}\n{self.formatException(record.exc_info)}"

        if self.use_colour and record.levelname in self._LEVEL_COLOURS:
            colour = self._LEVEL_COLOURS[record.levelname]
            text = f"{colour}{text}{self._RESET}"
        return text


def configure_logging(settings: Settings) -> None:
    """
    Install the root handler. Called once, from ``create_app()``.

    Safe to call more than once (tests create the app repeatedly) — it clears
    existing handlers first so log lines are not duplicated.
    """
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    root = logging.getLogger()
    root.setLevel(level)
    for handler in list(root.handlers):
        root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)

    if settings.LOG_FORMAT == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(ConsoleFormatter(use_colour=settings.LOG_COLOUR))

    root.addHandler(handler)

    # Third-party loggers that are noisy at INFO and useless below WARNING.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.SQL_ECHO else logging.WARNING
    )


class RequestContextFilter(logging.Filter):
    """
    Attach the current request id to every record.

    Without this, a log line emitted from deep inside a service layer has no
    idea which HTTP request caused it.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()  # type: ignore[attr-defined]
        return True


def log_timing(logger: logging.Logger, operation: str, started: float, **extra: Any) -> None:
    """
    Log how long something took. Used by the middleware and, later, by the
    ingestion jobs — the one number that makes a slow endpoint obvious.
    """
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    logger.info(
        "%s completed in %.2fms",
        operation,
        elapsed_ms,
        extra={"duration_ms": elapsed_ms, "operation": operation, **extra},
    )
