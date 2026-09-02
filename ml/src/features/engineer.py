"""Feature engineering for thermal event classification."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def add_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    """Extract hour, day-of-week, month, and is_night flag from acquisition data."""
    if "acq_date" in df.columns:
        acq_date = pd.to_datetime(df["acq_date"])
        df["month"] = acq_date.dt.month
        df["day_of_week"] = acq_date.dt.dayofweek
    else:
        df["month"] = 0
        df["day_of_week"] = 0

    if "acq_time" in df.columns:
        acq_time_str = df["acq_time"].astype(str).str.zfill(4)
        df["hour_of_day"] = acq_time_str.str[:2].astype(int)
    else:
        df["hour_of_day"] = 12

    df["is_night"] = (df["hour_of_day"] < 6) | (df["hour_of_day"] > 18)
    df["is_night"] = df["is_night"].astype(int)

    logger.debug(
        "Temporal features added: hour range [%d, %d], unique months: %d",
        df["hour_of_day"].min(),
        df["hour_of_day"].max(),
        df["month"].nunique(),
    )
    return df


def add_proximity_features(
    df: pd.DataFrame,
    industrial_sites: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Compute proximity to nearest industrial site.

    If industrial_sites is None, columns are filled with NaN and
    the GIS module is expected to populate them later.
    """
    df["proximity_to_industrial_km"] = np.nan

    if industrial_sites is None or industrial_sites.empty:
        logger.debug("No industrial sites provided; proximity left as NaN")
        return df

    from gis.scripts.coordinate_utils import haversine_distance

    for idx, row in df.iterrows():
        min_dist = float("inf")
        for _, site in industrial_sites.iterrows():
            dist = haversine_distance(
                row["latitude"],
                row["longitude"],
                site["latitude"],
                site["longitude"],
            )
            if dist < min_dist:
                min_dist = dist
        df.at[idx, "proximity_to_industrial_km"] = min_dist

    logger.debug(
        "Proximity computed. Mean: %.2f km, min: %.2f km",
        df["proximity_to_industrial_km"].mean(),
        df["proximity_to_industrial_km"].min(),
    )
    return df


def add_persistence_features(
    df: pd.DataFrame,
    historical_observations: pd.DataFrame | None = None,
    lookback_days: int = 30,
) -> pd.DataFrame:
    """Compute persistence score and historical event count.

    - persistence_score: fraction of days in lookback window with a
      thermal event at the same approximate location (within 0.01°).
    - historical_count: total number of prior events at that location.
    """
    df["persistence_score"] = 0.0
    df["historical_count"] = 0

    if historical_observations is None or historical_observations.empty:
        logger.debug("No historical observations; persistence features zeroed")
        return df

    obs = historical_observations.copy()
    if "acq_date" in obs.columns:
        obs["acq_date"] = pd.to_datetime(obs["acq_date"])

    for idx, row in df.iterrows():
        lat, lon = row["latitude"], row["longitude"]
        nearby = obs[
            (obs["latitude"].between(lat - 0.01, lat + 0.01))
            & (obs["longitude"].between(lon - 0.01, lon + 0.01))
        ]

        if "acq_date" in nearby.columns and pd.notna(row.get("acq_date")):
            event_date = pd.to_datetime(row["acq_date"])
            cutoff = event_date - pd.Timedelta(days=lookback_days)
            recent = nearby[nearby["acq_date"] >= cutoff]
            unique_dates = recent["acq_date"].dt.date.nunique()
            df.at[idx, "persistence_score"] = unique_dates / max(lookback_days, 1)

        df.at[idx, "historical_count"] = len(nearby)

    logger.debug(
        "Persistence features computed. Mean count: %.1f, mean score: %.3f",
        df["historical_count"].mean(),
        df["persistence_score"].mean(),
    )
    return df


def add_neighborhood_features(
    df: pd.DataFrame,
    radius_degrees: float = 0.05,
) -> pd.DataFrame:
    """Compute average FRP within a neighborhood of each point."""
    df["avg_frp_nearby"] = df["frp"]

    coords = df[["latitude", "longitude"]].values
    frp_values = df["frp"].values

    for i in range(len(df)):
        lat, lon = coords[i]
        mask = (
            np.abs(coords[:, 0] - lat) <= radius_degrees
            & np.abs(coords[:, 1] - lon) <= radius_degrees
        )
        neighbors = frp_values[mask]
        if len(neighbors) > 0:
            df.iloc[i, df.columns.get_loc("avg_frp_nearby")] = float(
                np.mean(neighbors)
            )

    logger.debug("Neighborhood FRP aggregation complete")
    return df


def add_scan_track_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add derived features from scan and track values."""
    if "scan" in df.columns and "track" in df.columns:
        df["pixel_area_km2"] = df["scan"] * df["track"] * 1.0
        df["frp_density"] = df["frp"] / df["pixel_area_km2"].clip(lower=0.001)
    else:
        df["pixel_area_km2"] = 1.0
        df["frp_density"] = df["frp"]
    return df


def engineer_features(
    df: pd.DataFrame,
    industrial_sites: pd.DataFrame | None = None,
    historical_observations: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Run the full feature engineering pipeline.

    Parameters
    ----------
    df:
        Cleaned FIRMS DataFrame.
    industrial_sites:
        Industrial site locations for proximity features.
    historical_observations:
        Historical thermal observations for persistence features.

    Returns
    -------
    DataFrame with all engineered features.
    """
    logger.info("Engineering features for %d records", len(df))

    df = add_temporal_features(df)
    df = add_proximity_features(df, industrial_sites=industrial_sites)
    df = add_persistence_features(
        df, historical_observations=historical_observations
    )
    df = add_neighborhood_features(df)
    df = add_scan_track_features(df)

    logger.info("Feature engineering complete: %d columns", len(df.columns))
    return df
