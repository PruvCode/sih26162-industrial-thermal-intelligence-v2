# ADR-009: Weak Supervision for Initial Labels

## Status
Accepted

## Context
SIH26162 has **no expert-labeled training data** at project start. We need labels to train the classifier, but manual labeling of thousands of events is infeasible in hackathon timeline.

## Decision
Use **weak supervision** with heuristic labeling rules based on OSM industrial proximity, persistence clustering, and land cover. Treat as noisy labels with confidence weights.

## Labeling Rules

```python
def generate_weak_labels(event: Dict) -> Tuple[str, float]:
    """
    Returns (predicted_class, label_confidence) based on heuristics.
    """
    dist = event.get('dist_to_nearest_industrial_km', 999)
    ind_type = event.get('nearest_industrial_type', '')
    cluster_count = event.get('cluster_detection_count', 1)
    brightness = event.get('brightness', 0)
    land_cover = event.get('land_cover_class', '')
    frp = event.get('frp', 0)
    
    # TIER 1: High confidence persistent sources (OSM-mapped flares/furnaces)
    if dist < 0.5 and ind_type in ['flare', 'high_temp_process'] and cluster_count >= 10:
        return 'persistent_thermal_source', 0.95
    
    # TIER 2: Likely industrial fire (near industry, sudden, hot)
    if dist < 1.0 and ind_type in ['chemical', 'refinery', 'steel', 'cement', 'power_plant']:
        if cluster_count < 5 and brightness > 350:
            return 'industrial_fire', 0.80
    
    # TIER 3: Likely wildfire (natural land cover, far from industry)
    if dist > 5.0 and land_cover in ['forest', 'grassland', 'shrubland', 'cropland']:
        if cluster_count < 3:
            return 'natural_wildfire', 0.75
    
    # TIER 4: Persistent but unmapped (no OSM tag but recurring)
    if cluster_count >= 20 and brightness > 300:
        return 'persistent_thermal_source', 0.70
    
    # TIER 5: Urban heat / other
    if dist < 2.0 and event.get('population_density', 0) > 5000:
        return 'other', 0.60
    
    # DEFAULT: Uncertain
    return 'other', 0.50
```

## Label Quality Tiers

| Tier | Source | Weight | Confidence | Est. Count |
|------|--------|--------|------------|------------|
| **Gold** | Expert verified (during SIH) | 10.0 | 1.0 | 500-1000 |
| **Silver** | High-confidence heuristics (Tier 1-2) | 2.0 | 0.8-0.95 | 50k-100k |
| **Bronze** | Medium-confidence heuristics (Tier 3-4) | 0.5 | 0.6-0.8 | 200k+ |
| **None** | Low confidence / conflicting | 0.0 | <0.5 | Remaining |

## Training with Weak Labels

```python
# Weighted training in XGBoost
sample_weights = df['label_confidence'] * df['label_tier_weight']

model.fit(
    X_train, y_train,
    sample_weight=sample_weights,
    eval_set=[(X_val, y_val)],
    sample_weight_eval_set=[val_weights]
)
```

## Human-in-the-Loop Refinement (During SIH)

1. **Day 1-2**: Generate weak labels for all historical data
2. **Day 3-4**: Train initial model, get predictions on recent data
3. **Day 5**: Analysts review:
   - Top 50 high-confidence predictions (verify)
   - Top 50 low-confidence predictions (correct)
   - Random 50 (quality check)
4. **Day 6**: Add expert labels as Gold tier, retrain
5. **Day 7**: Final model for demo

## Consequences

### Positive
- **Immediate start**: No labeling bottleneck
- **Scalable**: Rules apply to all historical data automatically
- **Iterative**: Expert labels progressively improve quality
- **Transparent**: Rules are auditable and adjustable

### Negative
- **Label noise**: Heuristics imperfect (e.g., unmapped flares, industrial fires in forests)
- **Bias**: Over-represents OSM-mapped sites, misses informal industry
- **Circularity**: Using OSM proximity to label, then using proximity as feature

### Mitigation
- **Downweight** features used in labeling (proximity, persistence) via regularization
- **Adversarial validation**: Check if model learns labeling rules vs. true signal
- **Expert correction**: Gold labels override weak labels

## Related
- ADR-003: XGBoost (sample_weight support)
- ADR-008: Temporal split (weak labels also temporal)
- ML Architecture: `docs/architecture/ml-architecture.md`
- Labeling UI (Future): `apps/web/src/features/labeling/`