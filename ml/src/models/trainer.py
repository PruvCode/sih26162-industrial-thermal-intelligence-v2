"""Model training, cross-validation, and versioned model persistence."""

from __future__ import annotations

import json
import logging
import pickle
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold, train_test_split

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts"


def prepare_features(
    df: pd.DataFrame,
    numeric_cols: list[str],
    categorical_cols: list[str],
) -> tuple[pd.DataFrame, list[str]]:
    """Select and encode features for model training."""
    feature_cols: list[str] = []

    available_numeric = [c for c in numeric_cols if c in df.columns]
    feature_cols.extend(available_numeric)

    for col in categorical_cols:
        if col in df.columns:
            dummies = pd.get_dummies(df[col], prefix=col, drop_first=False)
            df = pd.concat([df, dummies], axis=1)
            feature_cols.extend(dummies.columns.tolist())

    X = df[feature_cols].copy()
    X = X.fillna(0)
    return X, feature_cols


def encode_labels(
    labels: list[str], label_names: list[str]
) -> tuple[np.ndarray, dict[int, str]]:
    """Encode string labels to integers."""
    label_to_idx = {name: i for i, name in enumerate(label_names)}
    encoded = np.array([label_to_idx.get(str(l), len(label_names) - 1) for l in labels])
    idx_to_label = {i: name for name, i in label_to_idx.items()}
    return encoded, idx_to_label


def train_test_val_split(
    X: pd.DataFrame,
    y: np.ndarray,
    test_size: float = 0.2,
    val_size: float = 0.1,
    random_state: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, np.ndarray, np.ndarray, np.ndarray]:
    """Split data into train, validation, and test sets."""
    X_trainval, X_test, y_trainval, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )
    relative_val_size = val_size / (1 - test_size)
    X_train, X_val, y_train, y_val = train_test_split(
        X_trainval,
        y_trainval,
        test_size=relative_val_size,
        random_state=random_state,
        stratify=y_trainval,
    )
    logger.info(
        "Split: train=%d, val=%d, test=%d",
        len(X_train),
        len(X_val),
        len(X_test),
    )
    return X_train, X_val, X_test, y_train, y_val, y_test


def cross_validate(
    X: pd.DataFrame,
    y: np.ndarray,
    model_params: dict[str, Any],
    cv_folds: int = 5,
    random_state: int = 42,
) -> dict[str, list[float]]:
    """Run stratified k-fold cross-validation."""
    import xgboost as xgb

    skf = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=random_state)
    fold_scores: dict[str, list[float]] = {"accuracy": [], "f1_macro": []}

    for fold_idx, (train_idx, val_idx) in enumerate(skf.split(X, y)):
        X_fold_train = X.iloc[train_idx]
        X_fold_val = X.iloc[val_idx]
        y_fold_train = y[train_idx]
        y_fold_val = y[val_idx]

        model = xgb.XGBClassifier(**model_params)
        model.fit(
            X_fold_train,
            y_fold_train,
            eval_set=[(X_fold_val, y_fold_val)],
            verbose=False,
        )

        from sklearn.metrics import accuracy_score, f1_score

        y_pred = model.predict(X_fold_val)
        acc = accuracy_score(y_fold_val, y_pred)
        f1 = f1_score(y_fold_val, y_pred, average="macro", zero_division=0)

        fold_scores["accuracy"].append(float(acc))
        fold_scores["f1_macro"].append(float(f1))

        logger.info("Fold %d: accuracy=%.4f, f1=%.4f", fold_idx + 1, acc, f1)

    for metric, scores in fold_scores.items():
        logger.info(
            "CV %s: mean=%.4f +/- %.4f",
            metric,
            np.mean(scores),
            np.std(scores),
        )

    return fold_scores


def train_model(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    X_val: pd.DataFrame,
    y_val: np.ndarray,
    model_params: dict[str, Any],
) -> Any:
    """Train an XGBoost model."""
    import xgboost as xgb

    model = xgb.XGBClassifier(**model_params)
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )
    logger.info("Model trained with %d estimators", model_params.get("n_estimators", 100))
    return model


def save_model(
    model: Any,
    feature_columns: list[str],
    label_mapping: dict[int, str],
    cv_scores: dict[str, list[float]],
    config: dict[str, Any],
    version: str | None = None,
) -> Path:
    """Save model and metadata with version tracking."""
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    if version is None:
        version = f"v{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"

    model_path = ARTIFACTS_DIR / f"model_{version}.pkl"
    metadata_path = ARTIFACTS_DIR / f"metadata_{version}.json"

    artifact = {
        "model": model,
        "feature_columns": feature_columns,
        "label_mapping": {str(k): v for k, v in label_mapping.items()},
    }
    with open(model_path, "wb") as f:
        pickle.dump(artifact, f)

    metadata = {
        "version": version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "feature_columns": feature_columns,
        "label_mapping": label_mapping,
        "cv_scores": {k: [float(v) for v in vals] for k, vals in cv_scores.items()},
        "config": config,
    }
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2, default=str)

    logger.info("Model saved: %s", model_path)
    logger.info("Metadata saved: %s", metadata_path)
    return model_path


def load_model(model_path: str | Path) -> dict[str, Any]:
    """Load a saved model artifact."""
    with open(model_path, "rb") as f:
        artifact = pickle.load(f)  # noqa: S301
    logger.info("Model loaded from %s", model_path)
    return artifact


def train_pipeline(
    df: pd.DataFrame,
    label_column: str,
    config: dict[str, Any],
) -> Path:
    """Full training pipeline: split, train, evaluate, save.

    Parameters
    ----------
    df:
        DataFrame with engineered features and a label column.
    label_column:
        Name of the column containing string labels.
    config:
        Full ML config dict.

    Returns
    -------
    Path to saved model artifact.
    """
    training_cfg = config.get("training", {})
    model_cfg = config.get("model", {})
    feature_cfg = config.get("features", {})

    numeric_cols = feature_cfg.get("numeric", [])
    categorical_cols = feature_cfg.get("categorical", [])
    label_names = config.get("labels", [])

    X, feature_columns = prepare_features(df, numeric_cols, categorical_cols)
    y, label_mapping = encode_labels(df[label_column].tolist(), label_names)

    X_train, X_val, X_test, y_train, y_val, y_test = train_test_val_split(
        X,
        y,
        test_size=training_cfg.get("test_size", 0.2),
        val_size=training_cfg.get("val_size", 0.1),
        random_state=training_cfg.get("random_state", 42),
    )

    cv_scores = cross_validate(
        X_train,
        y_train,
        model_params=model_cfg.get("params", {}),
        cv_folds=training_cfg.get("cv_folds", 5),
        random_state=training_cfg.get("random_state", 42),
    )

    model = train_model(X_train, y_train, X_val, y_val, model_cfg.get("params", {}))

    model_path = save_model(
        model,
        feature_columns,
        label_mapping,
        cv_scores,
        config=config,
    )

    return model_path
