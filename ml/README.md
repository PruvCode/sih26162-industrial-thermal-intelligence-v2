# ML Module — Industrial Thermal Intelligence

Pipeline for classifying thermal events from NASA FIRMS data into:

| Label | Description |
|---|---|
| `industrial_fire` | Confirmed fire at an industrial facility |
| `persistent_thermal_source` | Recurring heat signature (e.g. flare stack, furnace) |
| `natural_or_wildfire` | Wildfire or controlled burn |
| `other` | Miscellaneous thermal anomaly |

## Directory Layout

```
ml/
├── configs/          # YAML configuration files
│   └── default.yaml
├── src/
│   ├── ingestion/    # FIRMS data fetching & CSV parsing
│   ├── preprocessing/# Cleaning, validation, deduplication
│   ├── features/     # Feature engineering (temporal, spatial, persistence)
│   ├── models/       # Training loop, cross-validation, model registry
│   ├── evaluation/   # Metrics & classification reports
│   ├── explainability# Human-readable explanations
│   └── inference/    # Prediction endpoint / batch inference
├── tests/            # Pytest test suite
└── artifacts/        # Trained models, encoders, scalers
```

## Quick Start

### 1. Install dependencies

```bash
pip install -e ".[ml]"
```

### 2. Train a model

```bash
python -m ml.src.models.trainer --config ml/configs/default.yaml
```

### 3. Run inference

```bash
python -m ml.src.inference.predictor \
  --model ml/artifacts/model_v1.pkl \
  --input data/processed/features.parquet \
  --output data/processed/predictions.parquet
```

### 4. Run tests

```bash
pytest ml/tests/ -v
```

## Data Assumptions

- Input data follows NASA FIRMS CSV column format (see `data/schemas/firms_columns.json`).
- Minimum required columns: `latitude`, `longitude`, `bright_ti4`, `frp`, `confidence`, `acq_date`, `acq_time`, `satellite`, `instrument`, `daynight`.
- Latitude range: \[-90, 90\]. Longitude range: \[-180, 180\].
- FRP (Fire Radiative Power) in MW — typically 0–50000.
- Brightness temperature (`bright_ti4`) in Kelvin — typically 200–600.
- Industrial site proximity is computed externally by the GIS module (`gis/scripts/spatial_ops.py`).
- Persistence score and historical count are computed by the GIS persistence module (`gis/scripts/persistence.py`).

## Feature Pipeline

1. **Raw ingestion** → validated DataFrame
2. **Cleaning** → drop invalid rows, impute missing values
3. **Feature engineering** → temporal, spatial, persistence, neighborhood aggregation
4. **Encoding** → one-hot encode categorical features
5. **Scaling** → optional standard scaling of numeric features
6. **Training** → XGBoost with stratified cross-validation
7. **Evaluation** → accuracy, precision, recall, F1, confusion matrix
8. **Explainability** → feature importance + human-readable text

## Configuration

All configuration is in `ml/configs/default.yaml`. Override with CLI flags or environment variables prefixed with `ML_`.
