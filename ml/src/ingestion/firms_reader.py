"""Read FIRMS CSV data into a pandas DataFrame with validation."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING

import pandas as pd

if TYPE_CHECKING:
    import sys

    if sys.version_info >= (3, 11):
        from typing import Self
    else:
        from typing_extensions import Self

logger = logging.getLogger(__name__)

FIRMS_REQUIRED_COLUMNS: list[str] = [
    "latitude",
    "longitude",
    "bright_ti4",
    "frp",
    "confidence",
    "acq_date",
    "acq_time",
    "satellite",
    "instrument",
    "daynight",
]

FIRMS_NUMERIC_COLUMNS: list[str] = [
    "latitude",
    "longitude",
    "bright_ti4",
    "bright_ti5",
    "frp",
    "scan",
    "track",
    "confidence",
    "bright_ti4",
]

FIRMS_OPTIONAL_COLUMNS: list[str] = [
    "bright_ti5",
    "version",
    "bright_t31",
    "frp",
    "scan",
    "track",
    "type",
    "_daynight",
]

COLUMN_ALIASES: dict[str, str] = {
    "bright_ti4": "bright_ti4",
    "BRIGHT_TI4": "bright_ti4",
    "bright_ti5": "bright_ti5",
    "BRIGHT_TI5": "bright_ti5",
    "frp": "frp",
    "FRP": "frp",
    "scan": "scan",
    "SCAN": "scan",
    "track": "track",
    "TRACK": "track",
    "confidence": "confidence",
    "CONFIDENCE": "confidence",
    "latitude": "latitude",
    "LATITUDE": "latitude",
    "lat": "latitude",
    "longitude": "longitude",
    "LONGITUDE": "longitude",
    "lon": "longitude",
    "lng": "longitude",
    "acq_date": "acq_date",
    "ACQ_DATE": "acq_date",
    "acq_time": "acq_time",
    "ACQ_TIME": "acq_time",
    "satellite": "satellite",
    "SATELLITE": "satellite",
    "instrument": "instrument",
    "INSTRUMENT": "instrument",
    "daynight": "daynight",
    "DAYNIGHT": "daynight",
}


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column names to lowercase canonical form."""
    rename_map: dict[str, str] = {}
    for col in df.columns:
        stripped = col.strip()
        canonical = COLUMN_ALIASES.get(stripped, stripped.lower())
        rename_map[col] = canonical
    return df.rename(columns=rename_map)


def validate_required_columns(df: pd.DataFrame) -> None:
    """Raise ValueError if required columns are missing."""
    missing = [c for c in FIRMS_REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        msg = f"Missing required FIRMS columns: {missing}"
        raise ValueError(msg)


def coerce_dtypes(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce columns to expected types."""
    float_cols = [
        "latitude",
        "longitude",
        "bright_ti4",
        "bright_ti5",
        "frp",
        "scan",
        "track",
        "confidence",
    ]
    for col in float_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    if "acq_date" in df.columns:
        df["acq_date"] = pd.to_datetime(df["acq_date"], errors="coerce").dt.date

    if "acq_time" in df.columns:
        df["acq_time"] = df["acq_time"].astype(str).str.zfill(4)

    str_cols = ["satellite", "instrument", "daynight"]
    for col in str_cols:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.upper()

    return df


def read_firms_csv(filepath: str | Path) -> pd.DataFrame:
    """Read a FIRMS CSV file, normalize columns, validate, and coerce types.

    Parameters
    ----------
    filepath:
        Path to a FIRMS CSV file.

    Returns
    -------
    Validated DataFrame with normalized column names.
    """
    filepath = Path(filepath)
    logger.info("Reading FIRMS data from %s", filepath)

    df = pd.read_csv(filepath, low_memory=False)
    df = normalize_columns(df)
    validate_required_columns(df)
    df = coerce_dtypes(df)

    logger.info(
        "Loaded %d rows, %d columns from %s", len(df), len(df.columns), filepath.name
    )
    return df


def read_firms_directory(directory: str | Path) -> pd.DataFrame:
    """Read all CSV files in a directory and concatenate."""
    directory = Path(directory)
    csv_files = sorted(directory.glob("*.csv"))
    if not csv_files:
        msg = f"No CSV files found in {directory}"
        raise FileNotFoundError(msg)

    frames: list[pd.DataFrame] = []
    for csv_file in csv_files:
        frames.append(read_firms_csv(csv_file))

    combined = pd.concat(frames, ignore_index=True)
    logger.info("Combined %d files into %d total rows", len(csv_files), len(combined))
    return combined
