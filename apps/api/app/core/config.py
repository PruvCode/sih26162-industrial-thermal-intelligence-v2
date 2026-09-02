"""
Application settings.

Every tunable the service has lives here, and nothing reads ``os.environ``
directly. That is the whole contract: one place to look, one place to validate,
and a typed object everywhere else.

Values come from, in increasing priority:
  1. the field defaults below,
  2. the ``.env`` file (see ``.env.example`` — never commit a real ``.env``),
  3. real environment variables.

Naming rule: the setting name is the environment variable name, verbatim. No
mapping tables, no surprises when someone reads the container spec.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Environments we recognise. Kept as a Literal so a typo fails at import time
# rather than silently disabling every production-only behaviour.
Environment = Literal["development", "test", "staging", "production"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # a stale key in .env must not crash startup
    )

    # --- Service identity -------------------------------------------------
    APP_NAME: str = "SIH26162 Thermal Intelligence API"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: Environment = "development"
    DEBUG: bool = False

    # --- HTTP server ------------------------------------------------------
    API_HOST: str = "0.0.0.0"  # noqa: S104 - inside a container this is correct
    API_PORT: int = 8000
    # Rendered behind a reverse proxy? Set true to honour X-Forwarded-*.
    TRUST_PROXY_HEADERS: bool = False

    # --- Database ---------------------------------------------------------
    # Async driver for the app; sync driver for Alembic (it cannot use asyncpg).
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/sih26162_thermal"
    )
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/sih26162_thermal"
    SQL_ECHO: bool = False
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT_SECONDS: int = 30

    # --- External integrations -------------------------------------------
    FIRMS_API_KEY: str = ""
    FIRMS_BASE_URL: str = "https://firms.modaps.eosdis.nasa.gov/api/area/json"
    FIRMS_MAP_KEY: str = ""
    # How long to wait for NASA FIRMS before giving up.
    FIRMS_TIMEOUT_SECONDS: int = 30

    ML_SERVICE_URL: str = "http://localhost:8001"
    ML_TIMEOUT_SECONDS: int = 30
    # When true, a failed ML call degrades to "unclassified" instead of
    # failing the request. Off in production so we notice that it broke.
    ML_FAIL_OPEN: bool = True

    # --- CORS -------------------------------------------------------------
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list[str] = ["*"]
    CORS_ALLOW_HEADERS: list[str] = ["*"]

    # --- Pagination -------------------------------------------------------
    PAGE_SIZE_DEFAULT: int = 20
    PAGE_SIZE_MAX: int = 100

    # --- Geospatial -------------------------------------------------------
    GEOMETRY_SRID: int = 4326

    # --- Logging ----------------------------------------------------------
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    LOG_FORMAT: Literal["console", "json"] = "console"
    LOG_COLOUR: bool = True

    # --- Request limits ---------------------------------------------------
    # 0 disables the check. This is a read-only API today.
    MAX_BODY_BYTES: int = 1_048_576  # 1 MiB
    REQUEST_TIMEOUT_SECONDS: int = 30

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        """
        Accept ``CORS_ORIGINS=http://a,http://b`` as well as a JSON list.

        pydantic-settings parses a JSON array for list fields, but a
        comma-separated string is what people actually write in a container
        env block, and the failure mode (a one-character "list") is baffling.
        """
        if isinstance(value, str) and value.strip() and not value.strip().startswith("["):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("LOG_FORMAT", mode="before")
    @classmethod
    def _normalise_log_format(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("LOG_LEVEL", mode="before")
    @classmethod
    def _normalise_log_level(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().upper()
        return value

    @field_validator("ENVIRONMENT", mode="before")
    @classmethod
    def _normalise_environment(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    # --- Derived helpers --------------------------------------------------
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def is_test(self) -> bool:
        return self.ENVIRONMENT == "test"

    @property
    def docs_enabled(self) -> bool:
        """
        Swagger/ReDoc in production is a choice, not a default.

        Flip it on deliberately when we decide this API is public.
        """
        return not self.is_production

    def safe_dict(self) -> dict[str, object]:
        """
        Settings with every credential masked. Safe to log at startup.
        """
        from app.core.logging import redact_mapping

        return redact_mapping(self.model_dump())


@lru_cache
def get_settings() -> Settings:
    """
    Cached so the `.env` file is read once per process.

    Tests that need different settings call ``get_settings.cache_clear()``.
    """
    return Settings()
