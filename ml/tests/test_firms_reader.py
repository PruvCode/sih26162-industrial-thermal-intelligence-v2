"""Tests for FIRMS CSV ingestion module."""

from __future__ import annotations

import csv
import tempfile
from pathlib import Path

import pandas as pd
import pytest

from ml.src.ingestion.firms_reader import (
    FIRMS_NUMERIC_COLUMNS,
    FIRMS_OPTIONAL_COLUMNS,
    FIRMS_REQUIRED_COLUMNS,
    COLUMN_ALIASES,
    coerce_dtypes,
    normalize_columns,
    read_firms_csv,
    read_firms_directory,
    validate_required_columns,
)


@pytest.fixture
def sample_firms_csv(tmp_path: Path) -> Path:
    """Create a minimal valid FIRMS CSV for testing."""
    csv_path = tmp_path / "firms_sample.csv"
    header = [
        "latitude", "longitude", "bright_ti4", "bright_ti5",
        "frp", "scan", "track", "confidence",
        "acq_date", "acq_time", "satellite", "instrument", "daynight",
    ]
    rows = [
        [22.3039, 70.8022, 320.1, 300.0, 45.2, 1.0, 1.0, 80, "2026-08-01", "1030", "Terra", "MODIS", "D"],
        [21.1702, 72.8311, 345.8, 310.0, 128.7, 1.2, 1.2, 100, "2026-08-01", "2200", "Suomi-NVIIRS", "VIIRS", "N"],
        [19.0760, 72.8777, 301.4, 290.0, 22.1, 1.0, 1.0, 60, "2026-08-02", "0515", "Terra", "MODIS", "D"],
    ]
    with open(csv_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)
    return csv_path


class TestNormalizeColumns:
    def test_lowercases_all_columns(self) -> None:
        df = pd.DataFrame({"LATITUDE": [1.0], "LONGITUDE": [2.0], "FRP": [3.0]})
        result = normalize_columns(df)
        assert list(result.columns) == ["latitude", "longitude", "frp"]

    def test_applies_aliases(self) -> None:
        df = pd.DataFrame({"lat": [1.0], "lon": [2.0], "BRIGHT_TI4": [300.0]})
        result = normalize_columns(df)
        assert list(result.columns) == ["latitude", "longitude", "bright_ti4"]

    def test_preserves_unknown_columns(self) -> None:
        df = pd.DataFrame({"latitude": [1.0], "custom_col": [2.0]})
        result = normalize_columns(df)
        assert "custom_col" in result.columns


class TestValidateRequiredColumns:
    def test_passes_with_all_required(self) -> None:
        df = pd.DataFrame({col: [1] for col in FIRMS_REQUIRED_COLUMNS})
        validate_required_columns(df)

    def test_raises_on_missing(self) -> None:
        df = pd.DataFrame({"latitude": [1], "longitude": [2]})
        with pytest.raises(ValueError, match="Missing required FIRMS columns"):
            validate_required_columns(df)


class TestCoerceDtypes:
    def test_converts_numeric(self) -> None:
        df = pd.DataFrame({"frp": ["45.2", "128.7"], "confidence": ["80", "100"]})
        result = coerce_dtypes(df)
        assert pd.api.types.is_float_dtype(result["frp"])
        assert pd.api.types.is_float_dtype(result["confidence"])

    def test_acq_time_padded(self) -> None:
        df = pd.DataFrame({"acq_time": ["530", "2200"]})
        result = coerce_dtypes(df)
        assert result["acq_time"].iloc[0] == "0530"
        assert result["acq_time"].iloc[1] == "2200"


class TestReadFirmsCsv:
    def test_reads_valid_csv(self, sample_firms_csv: Path) -> None:
        df = read_firms_csv(sample_firms_csv)
        assert len(df) == 3
        assert "latitude" in df.columns
        assert "frp" in df.columns

    def test_missing_required_raises(self, tmp_path: Path) -> None:
        csv_path = tmp_path / "bad.csv"
        csv_path.write_text("col_a,col_b\n1,2\n")
        with pytest.raises(ValueError, match="Missing required FIRMS columns"):
            read_firms_csv(csv_path)


class TestReadFirmsDirectory:
    def test_reads_multiple_files(self, tmp_path: Path) -> None:
        header = "latitude,longitude,bright_ti4,frp,confidence,acq_date,acq_time,satellite,instrument,daynight\n"
        for i in range(2):
            csv_path = tmp_path / f"file_{i}.csv"
            csv_path.write_text(header + f"22.3,70.8,320.0,45.0,80,2026-08-0{i+1},1030,Terra,MODIS,D\n")
        df = read_firms_directory(tmp_path)
        assert len(df) == 2

    def test_empty_directory_raises(self, tmp_path: Path) -> None:
        with pytest.raises(FileNotFoundError, match="No CSV files found"):
            read_firms_directory(tmp_path)


class TestFirmsColumnConstants:
    def test_no_duplicates_in_numeric_columns(self) -> None:
        assert len(FIRMS_NUMERIC_COLUMNS) == len(set(FIRMS_NUMERIC_COLUMNS))

    def test_required_columns_covered(self) -> None:
        for col in FIRMS_REQUIRED_COLUMNS:
            assert col in COLUMN_ALIASES or col in FIRMS_NUMERIC_COLUMNS
