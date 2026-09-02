"""Clean and validate FIRMS thermal event data."""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Physical / sensor bounds
LAT_MIN, LAT_MAX = -90.0, 90.0
LON_MIN, LON_MAX = -180.0, 180.0
FRP_MIN, FRP_MAX = 0.0, 50_000.0
BRIGHT_TI4_MIN, BRIGHT_TI4_MAX = 200.0, 600.0
CONFIDENCE_LEVELS = {"low", "nominal", "high"}
CONFIDENCE_SCORE_MAP = {"low": 0.3, "nominal": 0.6, "high": 1.0}


def remove_invalid_coordinates(df: pd.DataFrame) -> pd.DataFrame:
    """Drop rows with out-of-range latitude or longitude."""
    before = len(df)
    mask = (
        df["latitude"].between(LAT_MIN, LAT_MAX)
        & df["longitude"].between(LON_MIN, LON_MAX)
    )
    df = df[mask].copy()
    dropped = before - len(df)
    if dropped:
        logger.info("Dropped %d rows with invalid coordinates", dropped)
    return df


def validate_frp(df: pd.DataFrame) -> pd.DataFrame:
    """Clamp FRP to valid range; null out clearly erroneous values."""
    if "frp" not in df.columns:
        return df
    before = len(df)
    out_of_range = ~df["frp"].between(FRP_MIN, FRP_MAX) & df["frp"].notna()
    df.loc[out_of_range, "frp"] = np.nan
    df["frp"] = df["frp"].clip(lower=FRP_MIN, upper=FRP_MAX)
    dropped = out_of_range.sum()
    if dropped:
        logger.info("Corrected %d rows with out-of-range FRP values", dropped)
    return df


def validate_brightness(df: pd.DataFrame) -> pd.DataFrame:
    """Clamp brightness temperature to valid range."""
    if "bright_ti4" not in df.columns:
        return df
    out_of_range = (
        ~df["bright_ti4"].between(BRIGHT_TI4_MIN, BRIGHT_TI4_MAX)
        & df["bright_ti4"].notna()
    )
    df.loc[out_of_range, "bright_ti4"] = np.nan
    df["bright_ti4"] = df["bright_ti4"].clip(
        lower=BRIGHT_TI4_MIN, upper=BRIGHT_TI4_MAX
    )
    dropped = out_of_range.sum()
    if dropped:
        logger.info("Corrected %d rows with out-of-range brightness", dropped)
    return df


def map_confidence(df: pd.DataFrame) -> pd.DataFrame:
    """Map string confidence labels to numeric scores."""
    if "confidence" in df.columns:
        if df["confidence"].dtype == object:
            df["confidence_score"] = (
                df["confidence"].str.lower().map(CONFIDENCE_SCORE_MAP)
            )
        else:
            df["confidence_score"] = df["confidence"] / 100.0
    return df


def filter_by_confidence(
    df: pd.DataFrame,
    min_confidence: str = "nominal",
) -> pd.DataFrame:
    """Filter to events at or above a minimum confidence level."""
    if "confidence" not in df.columns or df["confidence"].dtype != object:
        return df

    level_order = {"low": 0, "nominal": 1, "high": 2}
    min_level = level_order.get(min_confidence.lower(), 1)

    before = len(df)
    df = df[
        df["confidence"].str.lower().map(level_order).fillna(0) >= min_level
    ].copy()
    filtered = before - len(df)
    if filtered:
        logger.info(
            "Filtered %d rows below '%s' confidence", filtered, min_confidence
        )
    return df


def handle_missing_values(df: pd.DataFrame) -> pd.DataFrame:
    """Impute or drop missing values."""
    if "scan" in df.columns:
        df["scan"] = df["scan"].fillna(1.0)
    if "track" in df.columns:
        df["track"] = df["track"].fillna(1.0)
    if "frp" in df.columns:
        df["frp"] = df["frp"].fillna(df["frp"].median())
    if "bright_ti4" in df.columns:
        df["bright_ti4"] = df["bright_ti4"].fillna(df["bright_ti4"].median())
    if "satellite" in df.columns:
        df["satellite"] = df["satellite"].fillna("UNKNOWN")
    if "instrument" in df.columns:
        df["instrument"] = df["instrument"].fillna("UNKNOWN")
    if "daynight" in df.columns:
        df["daynight"] = df["daynight"].fillna("D")

    before = len(df)
    required = ["latitude", "longitude", "bright_ti4", "frp"]
    existing_required = [c for c in required if c in df.columns]
    df = df.dropna(subset=existing_required)
    dropped = before - len(df)
    if dropped:
        logger.info("Dropped %d rows with missing required fields", dropped)
    return df


def deduplicate(df: pd.DataFrame) -> pd.DataFrame:
    """Remove exact duplicate rows based on location + time."""
    before = len(df)
    dup_cols = [c for c in ["latitude", "longitude", "acq_date", "acq_time"] if c in df.columns]
    if dup_cols:
        df = df.drop_duplicates(subset=dup_cols, keep="first").copy()
    dropped = before - len(df)
    if dropped:
        logger.info("Removed %d duplicate rows", dropped)
    return df


def clean_firms_data(
    df: pd.DataFrame,
    min_confidence: str = "nominal",
) -> pd.DataFrame:
    """Run the full cleaning pipeline on a FIRMS DataFrame.

    Parameters
    ----------
    df:
        Raw FIRMS DataFrame.
    min_confidence:
        Minimum confidence level to retain ('low', 'nominal', 'high').

    Returns
    -------
    Cleaned DataFrame.
    """
    logger.info("Cleaning %d FIRMS records", len(df))

    df = remove_invalid_coordinates(df)
    df = validate_frp(df)
    df = validate_brightness(df)
    df = map_confidence(df)
    df = filter_by_confidence(df, min_confidence=min_confidence)
    df = handle_missing_values(df)
    df = deduplicate(df)

    logger.info("Cleaning complete: %d records remaining", len(df))
    return df
