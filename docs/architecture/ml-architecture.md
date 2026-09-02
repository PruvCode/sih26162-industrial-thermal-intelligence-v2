# ML Architecture — SIH26162

## Problem Formulation

**Task**: Multi-class classification of thermal anomalies into 4 categories:
1. `industrial_fire` — Uncontrolled combustion at industrial facilities
2. `persistent_thermal_source` — Legitimate recurring heat (flares, furnaces, kilns)
3. `natural_wildfire` — Forest/grassland fires, agricultural burning
4. `other` — Urban heat, false positives, volcanic, unknown

**Input**: Enriched thermal event + geospatial/temporal context (34 features)
**Output**: Class probabilities + calibrated confidence + SHAP explanations

## ML Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ML PIPELINE                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   DATA      │    │  FEATURES   │    │   MODEL     │    │  SERVING    │  │
│  │  PREPARATION│───▶│ ENGINEERING │───▶│  TRAINING   │───▶│  & INFERENCE│  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│        │                  │                  │                  │           │
│        ▼                  ▼                  ▼                  ▼           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ • Raw events│    │ • 34 feats  │    │ • XGBoost   │    │ • FastAPI   │  │
│  │ • Labels    │    │ • Scaling   │    │ • CV +      │    │ • Batch     │  │
│  │ • Splits    │    │ • Encoding  │    │   Optuna    │    │ • SHAP      │  │
│  │ • Leakage   │    │ • Versioning│    │ • MLflow    │    │ • Evidence  │  │
│  │   checks    │    │             │    │ • Registry  │    │ • Monitoring│  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1. Data Preparation

### 1.1 Labeling Strategy (Critical - No Ground Truth Initially)

Since we lack expert-labeled data at project start, we use **weak supervision**:

| Weak Label Source | Heuristic | Target Class | Confidence |
|-------------------|-----------|--------------|------------|
| **OSM Industrial Match** | Event within 500m of `industrial=chemical\|power_plant\|flare` + persistence >10 detections | `persistent_thermal_source` | 0.8 |
| **OSM Industrial Match** | Event within 200m of industrial + single detection + high brightness (>350K) | `industrial_fire` | 0.7 |
| **Land Cover** | Event in `forest`/`grassland` (ESA WorldCover) + no industrial within 5km + low persistence | `natural_wildfire` | 0.75 |
| **Persistence Cluster** | Cluster detection_count > 20, regular diurnal pattern, matches flare/furnace OSM tag | `persistent_thermal_source` | 0.85 |
| **Default** | Everything else | `other` | 0.5 |

### 1.2 Label Refinement Workflow

```
1. Generate weak labels for all historical events
2. Train initial model
3. Human experts review:
   - High-confidence predictions (agree/disagree)
   - Low-confidence predictions (provide label)
   - Random sample for quality check
4. Add expert labels to training set (higher weight)
5. Retrain → iterate
```

### 1.3 Train/Validation/Test Split

**Critical: Temporal split to prevent leakage**

```python
# Split by acquisition date, not random
TRAIN_CUTOFF = '2023-12-31'      # Train on 2023 and earlier
VAL_CUTOFF = '2024-03-31'        # Validate on Q1 2024
TEST_START = '2024-04-01'        # Test on Q2 2024+

# Spatial leakage check: no same cluster in train/val/test
# Group by cluster_id, split clusters not events
```

| Split | Period | Events (est.) | Purpose |
|-------|--------|---------------|---------|
| Train | Jan 2023 - Dec 2023 | ~500k | Model fitting |
| Val | Jan 2024 - Mar 2024 | ~100k | Hyperparameter tuning |
| Test | Apr 2024 - Jun 2024 | ~100k | Final evaluation |
| OOT | Jul 2024+ | Ongoing | Out-of-time monitoring |

## 2. Feature Engineering

### 2.1 Feature Dictionary (34 features)

| # | Feature | Type | Description | Source |
|---|---------|------|-------------|--------|
| 1 | `brightness` | Numeric | Brightness temperature (K) | FIRMS |
| 2 | `bright_t31` | Numeric | Band 31 BT (MODIS only) | FIRMS |
| 3 | `frp` | Numeric | Fire Radiative Power (MW) | FIRMS |
| 4 | `confidence_norm` | Numeric | FIRMS confidence 0-1 | FIRMS |
| 5 | `scan` | Numeric | Along-scan pixel size (km) | FIRMS |
| 6 | `track` | Numeric | Along-track pixel size (km) | FIRMS |
| 7 | `daynight` | Categorical | D/N | FIRMS |
| 8 | `satellite` | Categorical | Terra/Aqua/SNPP/NOAA20 | FIRMS |
| 9 | `instrument` | Categorical | MODIS/VIIRS | FIRMS |
| 10 | `hour_of_day` | Cyclic | sin/cos(2π*hour/24) | Derived |
| 11 | `day_of_week` | Cyclic | sin/cos(2π*dow/7) | Derived |
| 12 | `day_of_year` | Cyclic | sin/cos(2π*doy/365) | Derived |
| 13 | `is_weekend` | Binary | Sat/Sun | Derived |
| 14 | `dist_to_nearest_industrial_km` | Numeric | KNN distance | OSM Join |
| 15 | `nearest_industrial_type` | Categorical | chemical, power_plant, flare, ... | OSM Join |
| 16 | `nearest_industrial_name_similarity` | Numeric | Fuzzy match score | OSM Join |
| 17 | `land_cover_class` | Categorical | ESA WorldCover class | Raster |
| 18 | `population_density` | Numeric | Persons/km² (log) | WorldPop |
| 19 | `elevation_m` | Numeric | DEM elevation | SRTM/COPERNICUS |
| 20 | `admin_level_4` | Categorical | State/Province | Admin |
| 21 | `admin_level_6` | Categorical | District | Admin |
| 22 | `cluster_id` | Categorical | DBSCAN cluster | Clustering |
| 23 | `cluster_detection_count` | Numeric | Total detections in cluster | Clustering |
| 24 | `cluster_unique_dates` | Numeric | Active days in cluster | Clustering |
| 25 | `cluster_temporal_span_days` | Numeric | First to last detection | Clustering |
| 26 | `cluster_brightness_trend` | Numeric | K/day slope | Clustering |
| 27 | `cluster_regularity_score` | Numeric | 0-1 temporal regularity | Clustering |
| 28 | `cluster_seasonality_score` | Numeric | 0-1 annual cycle | Clustering |
| 29 | `days_since_last_detection` | Numeric | At same location | Historical |
| 30 | `detection_count_30d_1km` | Numeric | Spatiotemporal density | Historical |
| 31 | `brightness_zscore_local` | Numeric | Local anomaly (5km, 30d) | Historical |
| 32 | `industrial_density_5km` | Numeric | Count of industrial sites | OSM |
| 33 | `night_fire_ratio` | Numeric | Night/(Day+Night) 30d | Derived |
| 34 | `wind_speed_ms` | Numeric | ERA5 at acq time | Weather |

### 2.2 Feature Processing Pipeline

```python
# ml/src/features/feature_engineering.py

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, TargetEncoder
from sklearn.impute import SimpleImputer
from category_encoders import TargetEncoder as CATTargetEncoder

def get_feature_pipeline():
    """Returns fitted ColumnTransformer for train/inference consistency."""
    
    numeric_features = [
        'brightness', 'bright_t31', 'frp', 'confidence_norm',
        'scan', 'track', 'hour_sin', 'hour_cos', 'dow_sin', 'dow_cos',
        'doy_sin', 'doy_cos', 'dist_to_nearest_industrial_km',
        'population_density', 'elevation_m', 'cluster_detection_count',
        'cluster_unique_dates', 'cluster_temporal_span_days',
        'cluster_brightness_trend', 'cluster_regularity_score',
        'cluster_seasonality_score', 'days_since_last_detection',
        'detection_count_30d_1km', 'brightness_zscore_local',
        'industrial_density_5km', 'night_fire_ratio', 'wind_speed_ms'
    ]
    
    categorical_features = [
        'daynight', 'satellite', 'instrument', 'nearest_industrial_type',
        'land_cover_class', 'admin_level_4', 'admin_level_6', 'cluster_id'
    ]
    
    binary_features = ['is_weekend']
    
    # Numeric: impute median → scale
    numeric_transformer = Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])
    
    # Categorical: impute 'unknown' → target encode (high cardinality) or one-hot (low)
    categorical_transformer = Pipeline([
        ('imputer', SimpleImputer(strategy='constant', fill_value='unknown')),
        ('encoder', CATTargetEncoder(smoothing=10.0))  # Target encoding for high cardinality
    ])
    
    # Binary: impute 0
    binary_transformer = Pipeline([
        ('imputer', SimpleImputer(strategy='constant', fill_value=0))
    ])
    
    preprocessor = ColumnTransformer([
        ('num', numeric_transformer, numeric_features),
        ('cat', categorical_transformer, categorical_features),
        ('bin', binary_transformer, binary_features)
    ], remainder='drop', sparse_threshold=0.3)
    
    return preprocessor
```

### 2.3 Feature Versioning

```yaml
# ml/configs/feature_version.yaml
version: "v2024.01.15-feat-v1"
feature_hash: "sha256:abc123..."  # Hash of feature_definitions.yaml
created_at: "2024-01-15T10:00:00Z"
feature_count: 34
preprocessor_pkl: "artifacts/preprocessor_v1.pkl"
feature_stats_json: "artifacts/feature_stats_v1.json"
```

## 3. Model Training

### 3.1 Baseline: XGBoost

```python
# ml/src/models/train.py
import xgboost as xgb
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import classification_report, f1_score
import optuna

def objective(trial, X_train, y_train, X_val, y_val):
    params = {
        'objective': 'multi:softprob',
        'num_class': 4,
        'eval_metric': 'mlogloss',
        'tree_method': 'hist',
        'device': 'cuda' if torch.cuda.is_available() else 'cpu',
        
        # Tuned params
        'max_depth': trial.suggest_int('max_depth', 4, 10),
        'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
        'n_estimators': trial.suggest_int('n_estimators', 100, 1000),
        'subsample': trial.suggest_float('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
        'min_child_weight': trial.suggest_int('min_child_weight', 1, 10),
        'gamma': trial.suggest_float('gamma', 0, 5),
        'reg_alpha': trial.suggest_float('reg_alpha', 1e-8, 10, log=True),
        'reg_lambda': trial.suggest_float('reg_lambda', 1e-8, 10, log=True),
        
        # Class imbalance handling
        'scale_pos_weight': compute_scale_pos_weight(y_train),
    }
    
    model = xgb.XGBClassifier(**params, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    
    y_pred = model.predict(X_val)
    return f1_score(y_val, y_pred, average='macro')

def compute_scale_pos_weight(y):
    """Compute per-class weights for imbalanced data."""
    from collections import Counter
    counts = Counter(y)
    total = len(y)
    n_classes = len(counts)
    return [total / (n_classes * counts[i]) for i in range(n_classes)]
```

### 3.2 Training Config

```yaml
# ml/configs/train_config.yaml
experiment_name: "sih26162-industrial-fire-classification"
run_name: "xgboost-baseline-{{date}}"

data:
  train_path: "data/processed/train.parquet"
  val_path: "data/processed/val.parquet"
  test_path: "data/processed/test.parquet"
  feature_version: "v2024.01.15-feat-v1"

model:
  type: "xgboost"
  params:
    objective: "multi:softprob"
    num_class: 4
    eval_metric: "mlogloss"
    tree_method: "hist"
    device: "cpu"  # Change to cuda for GPU
    random_state: 42
    n_jobs: -1
    
    # Fixed params (after tuning)
    max_depth: 7
    learning_rate: 0.05
    n_estimators: 500
    subsample: 0.8
    colsample_bytree: 0.8
    min_child_weight: 3
    gamma: 1.0
    reg_alpha: 0.1
    reg_lambda: 1.0

training:
  early_stopping_rounds: 50
  verbose: 100
  
  # Class weights for imbalance
  class_weights:
    industrial_fire: 5.0
    persistent_thermal_source: 3.0
    natural_wildfire: 2.0
    other: 1.0

mlflow:
  tracking_uri: "http://localhost:5000"
  log_models: true
  register_model: true
  model_name: "sih26162-industrial-fire-classifier"
```

### 3.3 Handling Class Imbalance

| Class | Est. Prevalence | Weight | Strategy |
|-------|----------------|--------|----------|
| `other` | ~60% | 1.0 | Baseline |
| `natural_wildfire` | ~25% | 2.0 | Moderate upsampling |
| `persistent_thermal_source` | ~10% | 3.0 | SMOTE + weight |
| `industrial_fire` | ~5% | 5.0 | SMOTE + weight + focal loss |

```python
# Focal loss for XGBoost (custom objective)
def focal_loss_obj(y_pred, dtrain):
    y_true = dtrain.get_label()
    alpha = 0.25
    gamma = 2.0
    
    # Softmax
    probs = np.exp(y_pred) / np.sum(np.exp(y_pred), axis=1, keepdims=True)
    
    # Focal weight
    pt = probs[np.arange(len(y_true)), y_true.astype(int)]
    weight = alpha * (1 - pt) ** gamma
    
    grad = weight * (probs - np.eye(4)[y_true.astype(int)])
    hess = weight * probs * (1 - probs)
    
    return grad.flatten(), hess.flatten()
```

## 4. Evaluation

### 4.1 Metrics

```python
# ml/src/evaluation/metrics.py
from sklearn.metrics import (
    classification_report, confusion_matrix, 
    precision_recall_fscore_support, roc_auc_score
)
import numpy as np

def evaluate_model(y_true, y_pred, y_proba, class_names):
    """Comprehensive evaluation for multi-class."""
    
    # Per-class metrics
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, average=None, labels=range(4)
    )
    
    # Macro/micro averages
    macro_f1 = f1_score(y_true, y_pred, average='macro')
    micro_f1 = f1_score(y_true, y_pred, average='micro')
    weighted_f1 = f1_score(y_true, y_pred, average='weighted')
    
    # ROC-AUC (OvR)
    try:
        roc_auc_ovr = roc_auc_score(y_true, y_proba, multi_class='ovr', average='macro')
        roc_auc_ovo = roc_auc_score(y_true, y_proba, multi_class='ovo', average='macro')
    except ValueError:
        roc_auc_ovr = roc_auc_ovo = None
    
    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred, labels=range(4))
    
    return {
        'per_class': {
            class_names[i]: {
                'precision': float(precision[i]),
                'recall': float(recall[i]),
                'f1': float(f1[i]),
                'support': int(support[i])
            } for i in range(4)
        },
        'macro_f1': float(macro_f1),
        'micro_f1': float(micro_f1),
        'weighted_f1': float(weighted_f1),
        'roc_auc_ovr': float(roc_auc_ovr) if roc_auc_ovr else None,
        'roc_auc_ovo': float(roc_auc_ovo) if roc_auc_ovo else None,
        'confusion_matrix': cm.tolist(),
        'class_names': class_names
    }
```

### 4.2 Target Metrics (SIH MVP)

| Metric | Target | Minimum |
|--------|--------|---------|
| Macro F1 | >0.80 | >0.70 |
| Industrial Fire Recall | >0.85 | >0.75 |
| Persistent Source Precision | >0.80 | >0.70 |
| Wildfire F1 | >0.85 | >0.75 |
| Inference Latency (1000 events) | <2s | <5s |

## 5. Explainability (SHAP)

### 5.1 SHAP Integration

```python
# ml/src/explainability/shap_explainer.py
import shap
import xgboost as xgb

class IndustrialFireExplainer:
    def __init__(self, model: xgb.XGBClassifier, feature_names: list):
        self.model = model
        self.feature_names = feature_names
        # TreeExplainer is exact for tree models
        self.explainer = shap.TreeExplainer(model)
    
    def explain(self, X: np.ndarray, class_names: list) -> dict:
        """Generate SHAP explanations for predictions."""
        # shap_values: (n_samples, n_features, n_classes)
        shap_values = self.explainer.shap_values(X)
        base_values = self.explainer.expected_value
        
        results = []
        for i in range(X.shape[0]):
            sample_result = {}
            for c_idx, class_name in enumerate(class_names):
                sample_result[class_name] = {
                    'base_value': float(base_values[c_idx]) if np.isscalar(base_values) else float(base_values[c_idx]),
                    'shap_values': dict(zip(self.feature_names, shap_values[c_idx][i].tolist())),
                    'prediction': float(shap_values[c_idx][i].sum() + (base_values[c_idx] if np.isscalar(base_values) else base_values[c_idx]))
                }
            results.append(sample_result)
        
        return results
    
    def get_top_features(self, shap_dict: dict, predicted_class: str, top_k: int = 5) -> list:
        """Get top positive SHAP features for predicted class."""
        class_shap = shap_dict[predicted_class]['shap_values']
        sorted_features = sorted(class_shap.items(), key=lambda x: x[1], reverse=True)
        return [
            {'feature': feat, 'shap_value': val}
            for feat, val in sorted_features[:top_k]
            if val > 0
        ]
```

### 5.2 Evidence Builder (SHAP + Rules)

```python
# ml/src/explainability/evidence_builder.py
from dataclasses import dataclass
from typing import List, Dict, Any

@dataclass
class EvidenceFactor:
    factor: str
    weight: float  # -1 to 1
    detail: str
    source: str  # 'shap' | 'rule'

def build_evidence(
    shap_result: dict,
    features: dict,
    predicted_class: str,
    class_names: list
) -> Dict[str, Any]:
    """Combine SHAP + rule-based evidence for frontend."""
    
    positive_factors = []
    negative_factors = []
    
    # 1. SHAP-based factors (top 5 positive for predicted class)
    shap_features = shap_result[predicted_class]['shap_values']
    top_shap = sorted(shap_features.items(), key=lambda x: x[1], reverse=True)[:5]
    
    for feat, val in top_shap:
        if val > 0.01:  # Threshold
            positive_factors.append(EvidenceFactor(
                factor=feat,
                weight=min(val, 1.0),
                detail=_format_shap_detail(feat, features.get(feat), val),
                source='shap'
            ))
        elif val < -0.01:
            negative_factors.append(EvidenceFactor(
                factor=feat,
                weight=max(val, -1.0),
                detail=_format_shap_detail(feat, features.get(feat), val),
                source='shap'
            ))
    
    # 2. Rule-based factors (interpretable, domain-knowledge)
    rule_factors = _apply_rules(features, predicted_class)
    positive_factors.extend([f for f in rule_factors if f.weight > 0])
    negative_factors.extend([f for f in rule_factors if f.weight < 0])
    
    # 3. Sort by absolute weight
    positive_factors.sort(key=lambda x: abs(x.weight), reverse=True)
    negative_factors.sort(key=lambda x: abs(x.weight), reverse=True)
    
    return {
        'predicted_class': predicted_class,
        'confidence': shap_result[predicted_class]['prediction'],
        'positive_factors': [
            {'factor': f.factor, 'weight': f.weight, 'detail': f.detail, 'source': f.source}
            for f in positive_factors[:8]
        ],
        'negative_factors': [
            {'factor': f.factor, 'weight': f.weight, 'detail': f.detail, 'source': f.source}
            for f in negative_factors[:4]
        ],
        'shap_summary': {
            'top_features': [
                {'feature': feat, 'shap_value': val}
                for feat, val in top_shap[:10]
            ]
        }
    }

def _apply_rules(features: dict, predicted_class: str) -> List[EvidenceFactor]:
    """Domain-knowledge rules for evidence."""
    factors = []
    
    dist = features.get('dist_to_nearest_industrial_km', 999)
    ind_type = features.get('nearest_industrial_type', '')
    cluster_count = features.get('cluster_detection_count', 0)
    brightness = features.get('brightness', 0)
    trend = features.get('cluster_brightness_trend', 0)
    land_cover = features.get('land_cover_class', '')
    
    # Proximity rules
    if dist < 1.0 and ind_type in ['chemical', 'power_plant', 'flare', 'cement', 'steel']:
        factors.append(EvidenceFactor(
            factor='proximity_to_industrial',
            weight=0.35,
            detail=f"{dist:.1f}km from {ind_type} facility",
            source='rule'
        ))
    elif dist < 5.0:
        factors.append(EvidenceFactor(
            factor='proximity_to_industrial',
            weight=0.15,
            detail=f"{dist:.1f}km from nearest industrial site",
            source='rule'
        ))
    
    # Persistence rules
    if cluster_count >= 20:
        factors.append(EvidenceFactor(
            factor='high_persistence',
            weight=0.30,
            detail=f"{cluster_count} detections in cluster",
            source='rule'
        ))
    elif cluster_count >= 5:
        factors.append(EvidenceFactor(
            factor='moderate_persistence',
            weight=0.15,
            detail=f"{cluster_count} detections in cluster",
            source='rule'
        ))
    
    # Intensity rules
    if brightness > 350:
        factors.append(EvidenceFactor(
            factor='high_thermal_intensity',
            weight=0.25,
            detail=f"Brightness temp {brightness:.0f}K (95th percentile)",
            source='rule'
        ))
    
    # Trend rules
    if trend > 1.0:
        factors.append(EvidenceFactor(
            factor='intensifying_heat',
            weight=0.20,
            detail=f"Brightness increasing {trend:.1f}K/day",
            source='rule'
        ))
    elif trend < -1.0:
        factors.append(EvidenceFactor(
            factor='diminishing_heat',
            weight=-0.15,
            detail=f"Brightness decreasing {abs(trend):.1f}K/day",
            source='rule'
        ))
    
    # Land cover context
    if land_cover in ['forest', 'grassland', 'shrubland'] and dist > 5:
        factors.append(EvidenceFactor(
            factor='wildfire_prone_landcover',
            weight=0.10 if predicted_class == 'natural_wildfire' else -0.10,
            detail=f"Located in {land_cover} area",
            source='rule'
        ))
    
    return factors

def _format_shap_detail(feature: str, value: Any, shap_val: float) -> str:
    """Human-readable SHAP feature detail."""
    # Simplified formatting for key features
    formatters = {
        'dist_to_nearest_industrial_km': lambda v: f"{v:.1f}km to nearest industry",
        'cluster_detection_count': lambda v: f"{int(v)} detections in cluster",
        'brightness': lambda v: f"Brightness {v:.0f}K",
        'cluster_brightness_trend': lambda v: f"Trend {v:+.1f}K/day",
        'frp': lambda v: f"FRP {v:.1f}MW",
    }
    if feature in formatters:
        return formatters[feature](value)
    return f"{feature}: {value} (SHAP: {shap_val:+.3f})"
```

## 6. Model Serving

### 6.1 Inference Interface

```python
# ml/src/inference/predictor.py
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional
import numpy as np

@dataclass
class PredictionResult:
    event_id: str
    predicted_class: str
    confidence: float
    all_probabilities: dict
    evidence: dict
    model_version: str
    shap_values: Optional[dict] = None

class BasePredictor(ABC):
    @abstractmethod
    def predict(self, events: List[dict]) -> List[PredictionResult]:
        pass
    
    @abstractmethod
    def predict_single(self, event: dict) -> PredictionResult:
        pass

class XGBoostPredictor(BasePredictor):
    def __init__(self, model_path: str, preprocessor_path: str, feature_version: str):
        import joblib
        import xgboost as xgb
        from ml.src.explainability import IndustrialFireExplainer, build_evidence
        
        self.model = xgb.XGBClassifier()
        self.model.load_model(model_path)
        self.preprocessor = joblib.load(preprocessor_path)
        self.feature_version = feature_version
        self.explainer = IndustrialFireExplainer(self.model, self.preprocessor.feature_names_in_)
        self.class_names = ['industrial_fire', 'persistent_thermal_source', 'natural_wildfire', 'other']
    
    def predict(self, events: List[dict]) -> List[PredictionResult]:
        # Vectorize features
        X = self._vectorize(events)
        
        # Predict probabilities
        probas = self.model.predict_proba(X)
        pred_indices = np.argmax(probas, axis=1)
        
        # SHAP explanations
        shap_results = self.explainer.explain(X, self.class_names)
        
        # Build results
        results = []
        for i, event in enumerate(events):
            pred_class = self.class_names[pred_indices[i]]
            confidence = probas[i, pred_indices[i]]
            
            evidence = build_evidence(
                shap_results[i], 
                events[i],  # raw features
                pred_class,
                self.class_names
            )
            
            results.append(PredictionResult(
                event_id=event['id'],
                predicted_class=pred_class,
                confidence=float(confidence),
                all_probabilities={c: float(probas[i, j]) for j, c in enumerate(self.class_names)},
                evidence=evidence,
                model_version=self.feature_version,
                shap_values=shap_results[i]
            ))
        
        return results
    
    def _vectorize(self, events: List[dict]) -> np.ndarray:
        # Convert events to feature DataFrame matching training
        import pandas as pd
        df = pd.DataFrame([self._extract_features(e) for e in events])
        return self.preprocessor.transform(df)
    
    def _extract_features(self, event: dict) -> dict:
        # Same feature extraction as training
        from ml.src.features.feature_engineering import extract_features
        return extract_features(event)
```

### 6.2 Model Registry (MLflow)

```python
# Register best model
import mlflow

mlflow.set_tracking_uri("http://localhost:5000")
mlflow.set_experiment("sih26162-industrial-fire-classification")

with mlflow.start_run(run_name="xgboost-v3") as run:
    # Log params, metrics
    mlflow.log_params(best_params)
    mlflow.log_metrics(eval_metrics)
    
    # Log model with signature
    signature = mlflow.models.infer_signature(X_val, y_pred_proba)
    mlflow.xgboost.log_model(
        model, 
        "model",
        signature=signature,
        input_example=X_val[:5],
        registered_model_name="sih26162-industrial-fire-classifier"
    )

# Production: load from registry
model = mlflow.pyfunc.load_model("models:/sih26162-industrial-fire-classifier/Production")
```

## 7. Monitoring & Drift Detection

### 7.1 Data Drift

```python
# Monitor feature distributions
from evidently import ColumnMapping
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset

column_mapping = ColumnMapping(
    target='class',
    prediction='predicted_class',
    numerical_features=numeric_features,
    categorical_features=categorical_features
)

report = Report(metrics=[DataDriftPreset()])
report.run(reference_data=train_df, current_data=inference_df)
report.save_html("monitoring/data_drift_report.html")
```

### 7.2 Prediction Drift

```python
# Monitor prediction distribution shift
def check_prediction_drift(recent_preds: pd.DataFrame, baseline: dict) -> dict:
    """Compare class distribution to baseline."""
    current_dist = recent_preds['predicted_class'].value_counts(normalize=True)
    drift_scores = {}
    for cls in baseline:
        drift_scores[cls] = abs(current_dist.get(cls, 0) - baseline[cls])
    return {
        'drift_scores': drift_scores,
        'max_drift': max(drift_scores.values()),
        'alert': max(drift_scores.values()) > 0.15  # 15% shift threshold
    }
```

## 8. Future Extensions

| Extension | Effort | Value |
|-----------|--------|-------|
| **Deep Learning** (TabNet, FT-Transformer) | Medium | Better tabular performance |
| **Multimodal** (Satellite imagery patches + tabular) | High | Visual confirmation |
| **Active Learning** (Human-in-the-loop labeling) | Medium | Rapid label improvement |
| **Ensemble** (XGBoost + LightGBM + Neural) | Low | Robustness |
| **Online Learning** (River/creme) | High | Adapt to concept drift |
| **Uncertainty Quantification** (Conformal prediction) | Medium | Reliable confidence intervals |

## Related Documents
- [Data Flow](data-flow.md) — Feature engineering details
- [Database Architecture](database-architecture.md) — Feature store schema
- [Explainability Interface](../ml/src/explainability/)
- [Training Config](../ml/configs/train_config.yaml)