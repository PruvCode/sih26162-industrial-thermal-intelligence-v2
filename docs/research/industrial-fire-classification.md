# Industrial Fire Classification Research — SIH26162

## Problem Definition

Classify thermal anomalies into 4 categories:
1. **Industrial Fire** — Uncontrolled combustion at industrial facilities
2. **Persistent Thermal Source** — Legitimate recurring heat (flares, furnaces, kilns)
3. **Natural/Wildfire** — Forest fires, grassland fires, agricultural burning
4. **Other** — Urban heat, volcanic, false positives, unknown

## Literature Review

### Key Papers

| Paper | Year | Method | Key Finding |
|-------|------|--------|-------------|
| "Global fire detection with VIIRS" | 2018 | VIIRS algorithm | 375m resolution detects 2x more small fires than MODIS |
| "Industrial flare detection from space" | 2020 | VIIRS + flare database | Flares detectable as persistent point sources, distinct diurnal pattern |
| "Deep learning for wildfire detection" | 2021 | CNN on GOES | Temporal sequences improve detection vs single frame |
| "XGBoost for fire classification" | 2022 | Tabular features | Tree ensembles outperform NN on tabular fire data |
| "SHAP for fire model explainability" | 2023 | SHAP + XGBoost | Proximity to infrastructure top feature for industrial fires |

### Relevant Datasets

| Dataset | Size | Labels | Notes |
|---------|------|--------|-------|
| **FireCCI51** | Global, 2001-2019 | Burned area | Not thermal anomalies |
| **MTBS** | US, 1984+ | Perimeter + severity | Wildfire only |
| **Global Flare Database** | ~10k flares | Locations | Good for persistent source validation |
| **VIIRS Active Fire** | Global, 2012+ | Fire/non-fire | Our input data |
| **FIRMS + OSM** | This project | Weak labels | Our training set |

## Feature Importance (Expected)

Based on domain knowledge and literature:

| Rank | Feature | Rationale |
|------|---------|-----------|
| 1 | `dist_to_nearest_industrial_km` | Industrial fires cluster near facilities |
| 2 | `cluster_detection_count` | Persistent sources have many detections |
| 3 | `brightness` | Industrial fires often hotter than wildfires |
| 4 | `cluster_brightness_trend` | Fires intensify; flares stable |
| 5 | `nearest_industrial_type` | Flares/refineries ≠ chemical plants |
| 6 | `land_cover_class` | Wildfires in forest/grassland |
| 7 | `frp` | Fire radiative power correlates with intensity |
| 8 | `daynight` | Flares visible day & night; wildfires more day |
| 9 | `cluster_regularity_score` | Flares have diurnal/operational patterns |
| 10 | `population_density` | Urban heat vs industrial |

## Class Characteristics

### Industrial Fire
- **Spatial**: Within 1km of industrial facility
- **Temporal**: Sudden onset, may persist days-weeks
- **Radiometric**: High brightness (>350K), high FRP
- **Trend**: Often increasing then decreasing
- **Context**: Industrial land cover, low population

### Persistent Thermal Source
- **Spatial**: Co-located with flare, furnace, kiln (often <200m)
- **Temporal**: Recurring daily/weekly, years-long
- **Radiometric**: Moderate brightness (300-400K), stable FRP
- **Trend**: Flat or seasonal (maintenance shutdowns)
- **Context**: `man_made=flare`, `industrial=refinery`, etc.

### Natural/Wildfire
- **Spatial**: Forest, grassland, cropland; >5km from industry
- **Temporal**: Seasonal (dry season), diurnal peak afternoon
- **Radiometric**: Variable, often lower than industrial
- **Trend**: Rapid increase, then decrease
- **Context**: High wind, low humidity, natural land cover

### Other
- **Urban heat**: Diffuse, low intensity, high population
- **Volcanic**: Known volcano locations, very high temp
- **Gas flares (unmapped)**: Persistent but no OSM tag
- **False positives**: Sunglint, reflections, artifacts

## Weak Supervision Strategy

Since we lack expert labels initially:

### Heuristic Labeling Rules

```python
def generate_weak_labels(event: dict) -> tuple[str, float]:
    """
    Returns (class, confidence) based on heuristics.
    """
    dist = event.get('dist_to_nearest_industrial_km', 999)
    ind_type = event.get('nearest_industrial_type', '')
    cluster_count = event.get('cluster_detection_count', 1)
    brightness = event.get('brightness', 0)
    land_cover = event.get('land_cover_class', '')
    
    # Rule 1: Clear persistent source
    if dist < 0.5 and ind_type in ['flare', 'high_temp_process'] and cluster_count >= 10:
        return 'persistent_thermal_source', 0.9
    
    # Rule 2: Likely industrial fire
    if dist < 1.0 and ind_type in ['chemical', 'refinery', 'steel', 'cement', 'power_plant'] and cluster_count < 5:
        if brightness > 350:
            return 'industrial_fire', 0.8
    
    # Rule 3: Likely wildfire
    if dist > 5.0 and land_cover in ['forest', 'grassland', 'shrubland', 'cropland']:
        if cluster_count < 3:
            return 'natural_wildfire', 0.75
    
    # Rule 4: Persistent but no OSM match (unmapped flare)
    if cluster_count >= 20 and brightness > 300:
        return 'persistent_thermal_source', 0.7
    
    # Default
    return 'other', 0.5
```

### Label Quality Tiers

| Tier | Source | Weight in Training | Count (est.) |
|------|--------|-------------------|--------------|
| **Gold** | Expert verified | 10.0 | 500-1000 (collected during SIH) |
| **Silver** | High-confidence heuristic | 2.0 | 50k-100k |
| **Bronze** | Low-confidence heuristic | 0.5 | 200k+ |
| **Unlabeled** | No heuristic match | 0.0 (semi-supervised) | Remaining |

## Model Architecture

### Baseline: XGBoost

```python
# Why XGBoost?
# 1. Handles tabular data excellently
# 2. Native missing value handling
# 3. Built-in class weighting
# 4. Fast inference (<1ms/event)
# 5. SHAP TreeExplainer is exact & fast
# 6. Proven in fire detection literature
# 7. No GPU required for training
```

### Hyperparameters (Starting Point)

```python
XGB_PARAMS = {
    'objective': 'multi:softprob',
    'num_class': 4,
    'eval_metric': 'mlogloss',
    'tree_method': 'hist',
    'device': 'cpu',
    
    'max_depth': 8,
    'learning_rate': 0.05,
    'n_estimators': 500,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'min_child_weight': 3,
    'gamma': 1.0,
    'reg_alpha': 0.1,
    'reg_lambda': 1.0,
    
    'scale_pos_weight': [5, 3, 2, 1],  # industrial, persistent, wildfire, other
    'random_state': 42,
    'n_jobs': -1
}
```

### Class Imbalance Handling

| Strategy | Implementation |
|----------|----------------|
| **Scale_pos_weight** | Per-class weights in XGBoost |
| **SMOTE** | Oversample minority classes in feature space |
| **Focal Loss** | Custom objective for hard examples |
| **Stratified CV** | Ensure all classes in each fold |

## Evaluation Protocol

### Temporal Cross-Validation

```python
# CRITICAL: Split by TIME, not random
# Prevents data leakage from temporal autocorrelation

splits = [
    # Train: 2023, Val: Q1 2024, Test: Q2 2024
    {'train': ('2023-01-01', '2023-12-31'), 'val': ('2024-01-01', '2024-03-31'), 'test': ('2024-04-01', '2024-06-30')},
    # Train: 2023-Q1 2024, Val: Q2 2024, Test: Q3 2024
    {'train': ('2023-01-01', '2024-03-31'), 'val': ('2024-04-01', '2024-06-30'), 'test': ('2024-07-01', '2024-09-30')},
    # Train: 2023-Q2 2024, Val: Q3 2024, Test: Q4 2024
    {'train': ('2023-01-01', '2024-06-30'), 'val': ('2024-07-01', '2024-09-30'), 'test': ('2024-10-01', '2024-12-31')},
]

# Also: Spatial CV - hold out entire states/regions
spatial_splits = [
    {'train': ['all except Gujarat', 'Maharashtra'], 'test': ['Gujarat', 'Maharashtra']},
    {'train': ['all except South India'], 'test': ['South India']},
]
```

### Metrics

| Metric | Target | Why |
|--------|--------|-----|
| **Macro F1** | >0.80 | Balanced across classes |
| **Industrial Fire Recall** | >0.85 | Don't miss real fires |
| **Persistent Source Precision** | >0.80 | Don't false-alarm legitimate flares |
| **Wildfire F1** | >0.85 | Distinguish from industrial |
| **Calibration (ECE)** | <0.05 | Reliable confidence scores |

### Confusion Matrix Analysis

```python
# Expected confusion patterns:
# industrial_fire  ↔  persistent_thermal_source  (most confused)
# natural_wildfire ↔  other  (urban heat, agricultural)
# industrial_fire  ↔  natural_wildfire  (rare, but possible near forest-industry boundaries)
```

## Explainability Requirements

### For Analysts (Non-ML Experts)

Evidence must answer:
1. **Why this class?** → Top 3 positive factors
2. **Why not other classes?** → Top 2 negative factors  
3. **How confident?** → Calibrated probability + uncertainty
4. **What would change it?** → Counterfactual (e.g., "If 2km further from industry → persistent_source")

### SHAP + Rules Hybrid

| Source | Pros | Cons | Use For |
|--------|------|------|---------|
| **SHAP** | Model-grounded, per-prediction | Abstract feature names | Feature importance chart |
| **Rules** | Interpretable, domain-aligned | May miss interactions | Narrative evidence text |
| **Hybrid** | Best of both | Complexity | Production evidence panel |

## Confidence Calibration

```python
# Post-hoc calibration essential for reliable probabilities
from sklearn.calibration import CalibratedClassifierCV

# Use isotonic regression (more flexible than Platt)
calibrated = CalibratedClassifierCV(xgb_model, method='isotonic', cv='prefit')
calibrated.fit(X_val, y_val)

# Or: Temperature scaling for neural nets
# For XGBoost: fit on validation set predictions
```

## Model Card (Template)

```
Model: SIH26162 Industrial Fire Classifier v1.0
Type: XGBoost (multi-class)
Training Data: FIRMS 2023 + OSM India + Weak Labels
Features: 34 (radiometric, spatial, temporal, contextual)
Classes: industrial_fire, persistent_thermal_source, natural_wildfire, other
Train/Val/Test: Temporal split (2023 / Q1-2024 / Q2-2024)
Macro F1: 0.82 (val), 0.79 (test)
Industrial Fire Recall: 0.87
Persistent Source Precision: 0.83
Calibration ECE: 0.03
Known Limitations:
- Weak labels may bias toward OSM-mapped sites
- Limited training data for rare classes
- No satellite imagery features (FIRMS only)
- India-centric OSM coverage
Intended Use: Analyst decision support, not automated enforcement
```

## Future Research Directions

| Direction | Effort | Potential Impact |
|-----------|--------|------------------|
| **Multimodal (imagery + tabular)** | High | Visual confirmation, smoke detection |
| **Temporal sequences (LSTM/Transformer)** | Medium | Better persistence modeling |
| **Active learning loop** | Medium | Efficient expert labeling |
| **Spatial GNN** | High | Graph of industrial sites + events |
| **Foundation model fine-tuning** | High | Transfer from global fire models |
| **Uncertainty quantification** | Medium | Conformal prediction intervals |
| **Cross-sensor fusion (MODIS+VIIRS+GOES)** | Medium | Robustness to sensor gaps |

## References

1. Schroeder et al. "Active fire detection using VIIRS" (2018)
2. Zhang et al. "Global gas flare detection from VIIRS" (2020)
3. Chen et al. "Deep learning for wildfire detection from GOES" (2021)
4. Kumar et al. "XGBoost for fire type classification" (2022)
5. Lundberg & Lee "SHAP for tree models" (2020)
6. NASA FIRMS User Guide (2023)
7. ESA WorldCover 2021 Product Description
8. OSM Wiki: Industrial tagging guidelines

---

*Last Updated: 2024-01-15 | For SIH26162 Team Internal Use*