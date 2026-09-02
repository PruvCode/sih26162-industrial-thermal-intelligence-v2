"""Evaluation metrics for thermal event classification."""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

logger = logging.getLogger(__name__)


def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    labels: list[str] | None = None,
) -> dict[str, Any]:
    """Compute all evaluation metrics.

    Parameters
    ----------
    y_true:
        Ground truth labels (integers or strings).
    y_pred:
        Predicted labels (integers or strings).
    labels:
        Optional list of class names for reporting.

    Returns
    -------
    Dictionary with metrics.
    """
    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, average="macro", zero_division=0)
    rec = recall_score(y_true, y_pred, average="macro", zero_division=0)
    f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
    cm = confusion_matrix(y_true, y_pred)

    report_text = classification_report(
        y_true, y_pred, target_names=labels, zero_division=0
    )

    per_class_precision = precision_score(
        y_true, y_pred, average=None, zero_division=0
    ).tolist()
    per_class_recall = recall_score(
        y_true, y_pred, average=None, zero_division=0
    ).tolist()
    per_class_f1 = f1_score(
        y_true, y_pred, average=None, zero_division=0
    ).tolist()

    metrics: dict[str, Any] = {
        "accuracy": float(acc),
        "precision_macro": float(prec),
        "recall_macro": float(rec),
        "f1_macro": float(f1),
        "confusion_matrix": cm.tolist(),
        "classification_report": report_text,
    }

    if labels:
        metrics["per_class"] = {
            label: {
                "precision": float(per_class_precision[i]),
                "recall": float(per_class_recall[i]),
                "f1": float(per_class_f1[i]),
            }
            for i, label in enumerate(labels)
            if i < len(per_class_precision)
        }

    logger.info("Accuracy: %.4f | F1 (macro): %.4f", acc, f1)
    return metrics


def format_confusion_matrix(
    cm: list[list[int]],
    labels: list[str],
) -> str:
    """Format confusion matrix as a readable table."""
    max_label_len = max(len(label) for label in labels)
    col_width = max(max_label_len, 8)

    header = " " * (col_width + 2) + "  ".join(
        f"{label:>{col_width}}" for label in labels
    )
    lines = [header, "-" * len(header)]

    for i, row_label in enumerate(labels):
        row_vals = "  ".join(f"{cm[i][j]:>{col_width}}" for j in range(len(labels)))
        lines.append(f"{row_label:>{col_width}}  {row_vals}")

    return "\n".join(lines)


def log_metrics(metrics: dict[str, Any]) -> None:
    """Log metrics at INFO level."""
    logger.info("=== Evaluation Results ===")
    logger.info("Accuracy:     %.4f", metrics["accuracy"])
    logger.info("Precision:    %.4f", metrics["precision_macro"])
    logger.info("Recall:       %.4f", metrics["recall_macro"])
    logger.info("F1 (macro):   %.4f", metrics["f1_macro"])
    logger.info("Confusion Matrix:\n%s", format_confusion_matrix(
        metrics["confusion_matrix"],
        list(metrics.get("per_class", {}).keys()),
    ))
    logger.info("Classification Report:\n%s", metrics["classification_report"])
