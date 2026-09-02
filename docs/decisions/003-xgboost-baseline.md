# ADR-003: XGBoost as Baseline Classifier

## Status
Accepted

## Context
We need a multi-class classifier for thermal anomalies (4 classes). The model must be:
- Fast inference (<10ms/event)
- Explainable (SHAP)
- Handle tabular features well
- Work with limited labeled data
- No GPU required for training

## Decision
Use **XGBoost** as the baseline classifier.

## Consequences

### Positive
- **Tabular champion**: Consistently wins on structured data (Kaggle, benchmarks)
- **Fast inference**: ~0.1ms/event on CPU, easily batchable
- **Native SHAP**: TreeSHAP is exact and fast for tree ensembles
- **Missing values**: Handles NaN natively (learns default direction)
- **Class weights**: Built-in `scale_pos_weight` for imbalance
- **No GPU needed**: Trains fast on CPU (hist method)
- **Model size**: ~10-50MB, easy to deploy
- **Proven in fire literature**: Multiple papers use XGBoost for fire classification

### Negative
- **No temporal modeling**: Treats each event independently (no sequence awareness)
- **Feature engineering required**: Doesn't learn representations automatically
- **Calibration needed**: Raw probabilities often overconfident
- **CatBoost alternative**: Better for high-cardinality categorical, but XGBoost sufficient

### Neutral
- LightGBM: Similar performance, slightly faster, but SHAP less mature
- Random Forest: Less accurate, slower inference, but more robust
- Neural Networks (TabNet, FT-Transformer): Higher ceiling but need more data, GPU, tuning

## Configuration

```python
XGB_PARAMS = {
    'objective': 'multi:softprob',
    'num_class': 4,
    'eval_metric': 'mlogloss',
    'tree_method': 'hist',        # Fast histogram-based
    'device': 'cpu',              # Change to 'cuda' if GPU available
    
    'max_depth': 8,
    'learning_rate': 0.05,
    'n_estimators': 500,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'min_child_weight': 3,
    'gamma': 1.0,
    'reg_alpha': 0.1,
    'reg_lambda': 1.0,
    
    # Class imbalance
    'scale_pos_weight': [5, 3, 2, 1],  # industrial, persistent, wildfire, other
    
    'random_state': 42,
    'n_jobs': -1,
    'early_stopping_rounds': 50
}
```

## Explainability Integration

```python
# SHAP TreeExplainer (exact for trees)
import shap
explainer = shap.TreeExplainer(xgb_model)
shap_values = explainer.shap_values(X)  # (n_classes, n_samples, n_features)
```

## Related
- ADR-007: SHAP for explainability
- ADR-008: Temporal split (critical for CV)
- ADR-009: Weak supervision (labeling strategy)
- ML Architecture: `docs/architecture/ml-architecture.md`