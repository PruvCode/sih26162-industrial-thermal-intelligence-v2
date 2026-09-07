"""Tests for FIRMS data cleaning/preprocessing module."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from ml.src.preprocessing.cleaner import (
    BRIGHT_TI4_MAX,
    BRIGHT_TI4_MIN,
    CONFIDENCE_SCORE_MAP,
    FRP_MAX,
    FRP_MIN,
    clean_firms_data,
    deduplicate,
    filter_by_confidence,
    handle_missing_values,
    map_confidence,
    remove_invalid_coordinates,
    validate_brightness,
    validate_frp,
)


@pytest.fixture
def raw_firms_df() -> pd.DataFrame:
    """A realistic raw FIRMS DataFrame for testing."""
    return pd.DataFrame(
        {
            "latitude": [22.3, 21.1, 19.0, 95.0, 22.5],
            "longitude": [70.8, 72.8, 72.8, 200.0, 88.3],
            "bright_ti4": [320.0, 345.8, 301.4, 250.0, 700.0],
            "frp": [45.2, 128.7, 22.1, 5.0, 45000.0],
            "confidence": ["high", "high", "nominal", "low", "high"],
            "acq_date": ["2026-08-01", "2026-08-01", "2026-08-02", "2026-08-02", "2026-08-03"],
            "acq_time": ["1030", "2200", "0515", "0800", "1400"],
            "satellite": ["Terra", "Suomi-NVIIRS", "Terra", "Terra", "Terra"],
            "instrument": ["MODIS", "VIIRS", "MODIS", "MODIS", "MODIS"],
            "daynight": ["D", "N", "D", "D", "D"],
            "scan": [1.0, 1.2, 1.0, np.nan, 1.0],
            "track": [1.0, 1.2, 1.0, np.nan, 1.0],
        }
    )


class TestRemoveInvalidCoordinates:
    def test_removes_out_of_range(self, raw_firms_df: pd.DataFrame) -> None:
        result = remove_invalid_coordinates(raw_firms_df)
        assert len(result) == 4
        assert 95.0 not in result["latitude"].values

    def test_keeps_valid_data(self) -> None:
        df = pd.DataFrame({"latitude": [0, -90, 90], "longitude": [0, -180, 180]})
        result = remove_invalid_coordinates(df)
        assert len(result) == 3


class TestValidateFrp:
    def test_nullifies_out_of_range(self) -> None:
        df = pd.DataFrame({"frp": [-10.0, 60000.0, 50.0]})
        result = validate_frp(df)
        assert pd.isna(result["frp"].iloc[0])
        assert pd.isna(result["frp"].iloc[1])
        assert result["frp"].iloc[2] == 50.0

    def test_clamps_valid(self) -> None:
        df = pd.DataFrame({"frp": [0.0, 50000.0, 250.0]})
        result = validate_frp(df)
        assert result["frp"].min() >= FRP_MIN
        assert result["frp"].max() <= FRP_MAX


class TestValidateBrightness:
    def test_nullifies_out_of_range(self) -> None:
        df = pd.DataFrame({"bright_ti4": [150.0, 650.0, 350.0]})
        result = validate_brightness(df)
        assert pd.isna(result["bright_ti4"].iloc[0])
        assert pd.isna(result["bright_ti4"].iloc[1])
        assert result["bright_ti4"].iloc[2] == 350.0


class TestMapConfidence:
    def test_maps_string_labels(self) -> None:
        df = pd.DataFrame({"confidence": ["low", "nominal", "high"]})
        result = map_confidence(df)
        assert result["confidence_score"].iloc[0] == CONFIDENCE_SCORE_MAP["low"]
        assert result["confidence_score"].iloc[1] == CONFIDENCE_SCORE_MAP["nominal"]
        assert result["confidence_score"].iloc[2] == CONFIDENCE_SCORE_MAP["high"]

    def test_numeric_confidence_divided_by_100(self) -> None:
        df = pd.DataFrame({"confidence": [30, 60, 100]})
        result = map_confidence(df)
        assert result["confidence_score"].iloc[0] == pytest.approx(0.3)
        assert result["confidence_score"].iloc[2] == pytest.approx(1.0)


class TestFilterByConfidence:
    def test_filters_below_nominal(self) -> None:
        df = pd.DataFrame({"confidence": ["low", "nominal", "high"]})
        result = filter_by_confidence(df, min_confidence="nominal")
        assert len(result) == 2
        assert "low" not in result["confidence"].values

    def test_keeps_all_when_low(self) -> None:
        df = pd.DataFrame({"confidence": ["low", "nominal", "high"]})
        result = filter_by_confidence(df, min_confidence="low")
        assert len(result) == 3


class TestHandleMissingValues:
    def test_imputes_scan_track(self) -> None:
        df = pd.DataFrame({"scan": [np.nan], "track": [np.nan]})
        result = handle_missing_values(df)
        assert result["scan"].iloc[0] == 1.0
        assert result["track"].iloc[0] == 1.0

    def test_drops_missing_required(self) -> None:
        df = pd.DataFrame(
            {
                "latitude": [22.3, np.nan],
                "longitude": [70.8, 72.8],
                "bright_ti4": [320.0, 300.0],
                "frp": [45.0, 20.0],
            }
        )
        result = handle_missing_values(df)
        assert len(result) == 1


class TestDeduplicate:
    def test_removes_exact_duplicates(self) -> None:
        df = pd.DataFrame(
            {
                "latitude": [22.3, 22.3, 21.1],
                "longitude": [70.8, 70.8, 72.8],
                "acq_date": ["2026-08-01", "2026-08-01", "2026-08-02"],
                "acq_time": ["1030", "1030", "1030"],
            }
        )
        result = deduplicate(df)
        assert len(result) == 2


class TestCleanFirmsData:
    def test_full_pipeline(self, raw_firms_df: pd.DataFrame) -> None:
        result = clean_firms_data(raw_firms_df, min_confidence="nominal")
        assert len(result) < len(raw_firms_df)
        assert all(c in result.columns for c in ["latitude", "longitude", "frp"])

    def test_pipeline_with_empty_df(self) -> None:
        df = pd.DataFrame(
            columns=["latitude", "longitude", "bright_ti4", "frp", "confidence"]
        )
        result = clean_firms_data(df)
        assert len(result) == 0
