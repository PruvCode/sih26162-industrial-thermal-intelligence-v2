# ADR-007: SHAP for Model Explainability

## Status
Accepted

## Context
SIH26162 requires **explainable AI** - analysts must understand *why* a thermal anomaly was classified as industrial fire vs. persistent source vs. wildfire. We need per-prediction explanations that are:
- Model-agnostic (work with any classifier)
- Fast enough for real-time (<100ms)
- Interpretable by non-ML experts
- Actionable for analysts

## Decision
Use **SHAP (SHapley Additive exPlanations)** with **TreeSHAP** for XGBoost, combined with **rule-based evidence** for domain alignment.

## Consequences

### Positive
- **Theoretically grounded**: Shapley values from game theory - only method with desirable properties (efficiency, symmetry, dummy, additivity)
- **Model-agnostic**: KernelSHAP works with any model; TreeSHAP is exact for trees
- **Local + Global**: Per-prediction + dataset-level feature importance
- **Fast for trees**: TreeSHAP is O(TLD²) - exact and fast for XGBoost/LightGBM
- **Visualization**: Built-in waterfall, beeswarm, dependence plots
- **Industry standard**: Used by Microsoft, Facebook, Uber, Airbnb for ML explainability

### Negative
- **KernelSHAP slow**: O(2^M) for model-agnostic - only use TreeSHAP
- **Feature dependence**: Assumes feature independence (TreeSHAP uses tree structure)
- **Computational cost**: Adds ~10-50ms per prediction (acceptable for batch)
- **Abstract features**: SHAP values on engineered features need translation to domain language

### Neutral
- **Alternatives considered**:
  - **LIME**: Local only, unstable, no global view → Rejected
  - **Integrated Gradients**: Neural net specific, needs baseline → Rejected
  - **Permutation Importance**: Global only, slow, no per-prediction → Rejected
  - **Custom rule-based only**: No model grounding, misses interactions → Rejected (but augment SHAP)

## Implementation

### SHAP + Rules Hybrid Evidence Builder

```python
# ml/src/explainability/evidence_builder.py

from dataclasses import dataclass
from typing import List, Dict, Any

@dataclass
class EvidenceFactor:
    factor: str           # Machine-readable key
    weight: float         # -1.0 to 1.0 (impact on predicted class)
    detail: str           # Human-readable explanation
    source: str           # 'shap' | 'rule'

def build_evidence(
    shap_result: Dict[str, Any],      # SHAP output per class
    raw_features: Dict[str, Any],      # Original feature values
    predicted_class: str,
    class_names: List[str]
) -> Dict[str, Any]:
    """
    Combine SHAP feature importance with domain rules.
    Returns structured evidence for frontend.
    """
    positive_factors = []
    negative_factors = []
    
    # 1. SHAP-based: Top features pushing toward predicted class
    class_shap = shap_result[predicted_class]['shap_values']
    top_shap = sorted(class_shap.items(), key=lambda x: x[1], reverse=True)[:5]
    
    for feat, val in top_shap:
        if val > 0.01:  # Threshold
            positive_factors.append(EvidenceFactor(
                factor=feat,
                weight=min(val, 1.0),
                detail=format_shap_detail(feat, raw_features.get(feat), val),
                source='shap'
            ))
        elif val < -0.01:
            negative_factors.append(EvidenceFactor(
                factor=feat,
                weight=max(val, -1.0),
                detail=format_shap_detail(feat, raw_features.get(feat), val),
                source='shap'
            ))
    
    # 2. Rule-based: Domain-knowledge factors (interpretable)
    rule_factors = apply_domain_rules(raw_features, predicted_class)
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

def apply_domain_rules(features: Dict, predicted_class: str) -> List[EvidenceFactor]:
    """Domain rules for human-interpretable evidence."""
    factors = []
    
    dist = features.get('dist_to_nearest_industrial_km', 999)
    ind_type = features.get('nearest_industrial_type', '')
    cluster_count = features.get('cluster_detection_count', 0)
    brightness = features.get('brightness', 0)
    trend = features.get('cluster_brightness_trend', 0)
    land_cover = features.get('land_cover_class', '')
    
    # Proximity
    if dist < 1.0 and ind_type in ['flare', 'chemical', 'refinery', 'power_plant']:
        factors.append(EvidenceFactor(
            factor='proximity_to_industrial',
            weight=0.35,
            detail=f"{dist:.1f}km from {ind_type} facility",
            source='rule'
        ))
    
    # Persistence
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
    
    # Intensity
    if brightness > 350:
        factors.append(EvidenceFactor(
            factor='high_thermal_intensity',
            weight=0.25,
            detail=f"Brightness temp {brightness:.0f}K (95th percentile)",
            source='rule'
        ))
    
    # Trend
    if trend > 1.0:
        factors.append(EvidenceFactor(
            factor='intensifying_heat',
            weight=0.20,
            detail=f"Brightness increasing {trend:.1f}K/day",
            source='rule'
        ))
    
    # Land cover context
    if land_cover in ['forest', 'grassland'] and dist > 5:
        weight = 0.10 if predicted_class == 'natural_wildfire' else -0.10
        factors.append(EvidenceFactor(
            factor='wildfire_prone_landcover',
            weight=weight,
            detail=f"Located in {land_cover} area",
            source='rule'
        ))
    
    return factors
```

## Frontend Integration

```tsx
// apps/web/src/components/panels/EvidencePanel.tsx
// Renders positive/negative factors as horizontal bars
// Shows SHAP waterfall chart using Recharts
```

## Related
- ADR-003: XGBoost baseline (TreeSHAP requirement)
- ML Architecture: `docs/architecture/ml-architecture.md`
- Explainability Module: `ml/src/explainability/`