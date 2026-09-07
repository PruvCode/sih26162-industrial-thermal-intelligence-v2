"""ML inference: load a trained model and classify thermal events."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from ml.src.models.trainer import load_model

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts"


def find_latest_model() -> Path | None:
    """Return the path to the most recently saved model artifact, or None."""
    if not ARTIFACTS_DIR.exists():
        return None
    model_files = sorted(ARTIFACTS_DIR.glob("model_*.pkl"))
    if not model_files:
        return None
    return model_files[-1]


class ThermalClassifier:
    """Load an XGBoost model and predict thermal event categories.

    Usage
    -----
    >>> classifier = ThermalClassifier.from_artifacts()
    >>> result = classifier.predict(df_with_features)
    """

    def __init__(
        self,
        model: Any,
        feature_columns: list[str],
        label_mapping: dict[int, str],
    ) -> None:
        self.model = model
        self.feature_columns = feature_columns
        self.label_mapping = label_mapping

    @classmethod
    def from_path(cls, model_path: str | Path) -> ThermalClassifier:
        """Load a classifier from a saved model artifact."""
        artifact = load_model(model_path)
        return cls(
            model=artifact["model"],
            feature_columns=artifact["feature_columns"],
            label_mapping={
                int(k): v for k, v in artifact["label_mapping"].items()
            },
        )

    @classmethod
    def from_artifacts(cls, artifacts_dir: str | Path | None = None) -> ThermalClassifier:
        """Load the latest model from the artifacts directory."""
        search_dir = Path(artifacts_dir) if artifacts_dir else ARTIFACTS_DIR
        model_files = sorted(search_dir.glob("model_*.pkl"))
        if not model_files:
            msg = f"No model artifacts found in {search_dir}"
            raise FileNotFoundError(msg)
        return cls.from_path(model_files[-1])

    def _align_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Ensure the DataFrame has all required feature columns in the correct order."""
        aligned = pd.DataFrame()
        for col in self.feature_columns:
            if col in df.columns:
                aligned[col] = df[col]
            else:
                aligned[col] = 0.0
        return aligned

    def predict(
        self,
        df: pd.DataFrame,
        return_probabilities: bool = True,
    ) -> list[dict[str, Any]]:
        """Classify a batch of thermal events.

        Parameters
        ----------
        df:
            DataFrame with engineered features.
        return_probabilities:
            If True, include per-class probabilities in results.

        Returns
        -------
        List of dicts with 'label', 'confidence', and optionally 'probabilities'.
        """
        aligned = self._align_features(df)
        predictions = self.model.predict(aligned)

        results: list[dict[str, Any]] = []

        if return_probabilities and hasattr(self.model, "predict_proba"):
            probabilities = self.model.predict_proba(aligned)
            for i, pred_idx in enumerate(predictions):
                pred_idx_int = int(pred_idx)
                results.append(
                    {
                        "label": self.label_mapping.get(pred_idx_int, "unknown"),
                        "confidence": float(probabilities[i][pred_idx_int]),
                        "probabilities": {
                            self.label_mapping[j]: float(probabilities[i][j])
                            for j in range(len(self.label_mapping))
                        },
                    }
                )
        else:
            for pred_idx in predictions:
                pred_idx_int = int(pred_idx)
                results.append(
                    {
                        "label": self.label_mapping.get(pred_idx_int, "unknown"),
                        "confidence": 1.0,
                    }
                )

        logger.info(
            "Classified %d events: %s",
            len(results),
            {r["label"] for r in results},
        )
        return results

    def predict_single(
        self,
        features: dict[str, float],
        return_probabilities: bool = True,
    ) -> dict[str, Any]:
        """Classify a single event from a feature dict."""
        df = pd.DataFrame([features])
        results = self.predict(df, return_probabilities=return_probabilities)
        return results[0]
