# ADR-008: Temporal Train/Validation/Test Split

## Status
Accepted

## Context
Thermal anomaly data has strong **temporal autocorrelation** - events from the same cluster appear close in time. Random splitting leaks future information into training, causing inflated metrics.

## Decision
Use **strict temporal splits** for all model evaluation. No random shuffling.

## Split Strategy

### Primary Split (Chronological)
| Split | Period | Purpose |
|-------|--------|---------|
| **Train** | Jan 2023 – Dec 2023 | Model fitting, hyperparameter tuning |
| **Validation** | Jan 2024 – Mar 2024 | Model selection, early stopping |
| **Test** | Apr 2024 – Jun 2024 | Final unbiased evaluation |
| **OOT (Out-of-Time)** | Jul 2024+ | Production monitoring |

### Spatial Leakage Prevention
Even with temporal split, events from the **same spatial cluster** can appear in train and val if cluster spans boundary.

**Solution**: Group by `cluster_id`, split clusters not events.

```python
def temporal_cluster_split(events_gdf, train_end, val_end):
    """Split by cluster to prevent spatial leakage."""
    # Get unique clusters per period
    train_clusters = events_gdf[
        events_gdf.acq_datetime <= train_end
    ].cluster_id.unique()
    
    val_clusters = events_gdf[
        (events_gdf.acq_datetime > train_end) & 
        (events_gdf.acq_datetime <= val_end)
    ].cluster_id.unique()
    
    test_clusters = events_gdf[
        events_gdf.acq_datetime > val_end
    ].cluster_id.unique()
    
    # Remove overlap
    val_clusters = [c for c in val_clusters if c not in train_clusters]
    test_clusters = [c for c in test_clusters if c not in train_clusters and c not in val_clusters]
    
    train = events_gdf[events_gdf.cluster_id.isin(train_clusters)]
    val = events_gdf[events_gdf.cluster_id.isin(val_clusters)]
    test = events_gdf[events_gdf.cluster_id.isin(test_clusters)]
    
    return train, val, test
```

### Cross-Validation (Time Series CV)
```python
from sklearn.model_selection import TimeSeriesSplit

# 3-fold expanding window
tscv = TimeSeriesSplit(n_splits=3, test_size=int(90*24*3600), gap=int(7*24*3600))
# gap = 7 days to prevent leakage from persistence features
```

## Consequences

### Positive
- **Realistic metrics**: Reflects true production performance
- **No leakage**: Future events never influence past predictions
- **Drift detection**: OOT split enables monitoring distribution shift

### Negative
- **Less training data**: Older data only (but more realistic)
- **Seasonality**: Train may miss some seasonal patterns (mitigate with 2+ years)
- **Cluster split complexity**: Need cluster IDs before split

### Neutral
- **Standard practice**: Required for any time-series ML (finance, weather, IoT)
- **Regulatory**: Often mandated for high-stakes ML (finance, healthcare)

## Related
- ADR-003: XGBoost baseline (needs proper CV)
- ADR-009: Weak supervision (labels also temporal)
- ML Architecture: `docs/architecture/ml-architecture.md`