"""Tests for thermal event feature engineering module."""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd
import pytest

from ml.src.features.engineer import (
    add_neighborhood_features,
    add_persistence_features,
    add_scan_track_features,
    add_temporal_features,
    engineer_features,
)


@pytest.fixture
def clean_df() -> pd.DataFrame:
    """A cleaned FIRMS DataFrame ready for feature engineering."""
    return pd.DataFrame(
        {
            "latitude": [22.3, 21.1, 19.0],
            "longitude": [70.8, 72.8, 72.8],
            "bright_ti4": [320.0, 345.8, 301.4],
            "frp": [45.2, 128.7, 22.1],
            "confidence_score": [1.0, 1.0, 0.6],
            "acq_date": ["2026-08-01", "2026-08-01", "2026-08-02"],
            "acq_time": ["1030", "2200", "0515"],
            "satellite": ["Terra", "Suomi-NVIIRS", "Terra"],
            "instrument": ["MODIS", "VIIRS", "MODIS"],
            "daynight": ["D", "N", "D"],
            "scan": [1.0, 1.2, 1.0],
            "track": [1.0, 1.2, 1.0],
        }
    )


class TestAddTemporalFeatures:
    def test_extracts_month_and_day(self, clean_df: pd.DataFrame) -> None:
        result = add_temporal_features(clean_df)
        assert "month" in result.columns
        assert "day_of_week" in result.columns
        assert result["month"].iloc[0] == 8
        assert result["day_of_week"].iloc[0] == 5  # Friday

    def test_extracts_hour(self, clean_df: pd.DataFrame) -> None:
        result = add_temporal_features(clean_df)
        assert "hour_of_day" in result.columns
        assert result["hour_of_day"].iloc[0] == 10
        assert result["hour_of_day"].iloc[1] == 22

    def test_is_night_flag(self, clean_df: pd.DataFrame) -> None:
        result = add_temporal_features(clean_df)
        assert "is_night" in result.columns
        assert result["is_night"].iloc[0] == 0  # 10am -> not night
        assert result["is_night"].iloc[1] == 1  # 10pm -> night

    def test_handles_missing_date(self) -> None:
        df = pd.DataFrame({"acq_time": ["1030"]})
        result = add_temporal_features(df)
        assert result["month"].iloc[0] == 0
        assert result["hour_of_day"].iloc[0] == 10


class TestAddProximityFeatures:
    def test_returns_nan_without_sites(self, clean_df: pd.DataFrame) -> None:
        result = add_proximity_features(clean_df)
        assert "proximity_to_industrial_km" in result.columns
        assert result["proximity_to_industrial_km"].isna().all()


class TestAddPersistenceFeatures:
    def test_zeros_without_history(self, clean_df: pd.DataFrame) -> None:
        result = add_persistence_features(clean_df)
        assert "persistence_score" in result.columns
        assert "historical_count" in result.columns
        assert (result["persistence_score"] == 0.0).all()
        assert (result["historical_count"] == 0).all()

    def test_computes_with_history(self, clean_df: pd.DataFrame) -> None:
        history = pd.DataFrame(
            {
                "latitude": [22.305, 22.301, 22.310],
                "longitude": [70.805, 70.801, 70.810],
                "acq_date": [
                    "2026-07-28",
                    "2026-07-30",
                    "2026-08-01",
                ],
            }
        )
        result = add_persistence_features(clean_df, historical_observations=history)
        assert result["historical_count"].iloc[0] == 3
        assert result["persistence_score"].iloc[0] > 0


class TestAddNeighborhoodFeatures:
    def test_computes_avg_frp(self, clean_df: pd.DataFrame) -> None:
        result = add_neighborhood_features(clean_df, radius_degrees=0.05)
        assert "avg_frp_nearby" in result.columns
        assert result["avg_frp_nearby"].iloc[0] == pytest.approx(45.2)

    def test_uses_frp_when_isolated(self) -> None:
        df = pd.DataFrame(
            {"latitude": [22.3], "longitude": [70.8], "frp": [45.2]}
        )
        result = add_neighborhood_features(df, radius_degrees=0.001)
        assert result["avg_frp_nearby"].iloc[0] == pytest.approx(45.2)


class TestAddScanTrackFeatures:
    def test_computes_pixel_area_and_density(self, clean_df: pd.DataFrame) -> None:
        result = add_scan_track_features(clean_df)
        assert "pixel_area_km2" in result.columns
        assert "frp_density" in result.columns
        assert result["pixel_area_km2"].iloc[0] == pytest.approx(1.0)
        assert result["frp_density"].iloc[0] == pytest.approx(45.2)


class TestEngineerFeatures:
    def test_full_pipeline(self, clean_df: pd.DataFrame) -> None:
        result = engineer_features(clean_df)
        expected_cols = [
            "month", "day_of_week", "hour_of_day", "is_night",
            "proximity_to_industrial_km", "persistence_score",
            "historical_count", "avg_frp_nearby", "pixel_area_km2",
            "frp_density",
        ]
        for col in expected_cols:
            assert col in result.columns, f"Missing feature: {col}"

    def test_preserves_original_data(self, clean_df: pd.DataFrame) -> None:
        result = engineer_features(clean_df)
        assert len(result) == len(clean_df)
        assert result["latitude"].iloc[0] == 22.3
