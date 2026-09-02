# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the SIH26162 project. Each ADR documents a significant architectural decision, its context, and consequences.

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](001-firms-primary-source.md) | FIRMS as Primary Data Source | Accepted | 2024-01-10 |
| [002](002-postgis-spatial-backend.md) | PostgreSQL + PostGIS for Spatial Backend | Accepted | 2024-01-10 |
| [003](003-xgboost-baseline.md) | XGBoost as Baseline Classifier | Accepted | 2024-01-11 |
| [004](004-maplibre-frontend.md) | MapLibre GL JS for Frontend Mapping | Accepted | 2024-01-11 |
| [005](005-fastapi-backend.md) | FastAPI for Backend API | Accepted | 2024-01-12 |
| [006](006-nextjs-frontend.md) | Next.js 14 App Router for Frontend | Accepted | 2024-01-12 |
| [007](007-shap-explainability.md) | SHAP for Model Explainability | Accepted | 2024-01-13 |
| [008](008-temporal-split.md) | Temporal Train/Val/Test Split | Accepted | 2024-01-13 |
| [009](009-weak-supervision.md) | Weak Supervision for Initial Labels | Accepted | 2024-01-14 |
| [010](010-monorepo-structure.md) | Monorepo with apps/packages | Accepted | 2024-01-10 |

## ADR Template

When creating a new ADR, use this template:

```markdown
# ADR-XXX: Title

## Status
[Proposed | Accepted | Rejected | Superseded]

## Context
What is the issue that we're seeing that is motivating this decision?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
### Positive
- 

### Negative
- 

### Neutral
- 

## Alternatives Considered
- Alternative 1: Reason for rejection
- Alternative 2: Reason for rejection

## Related
- ADR-XXX: Related decision
- Issue #XXX: Related issue
```

## Process

1. **Propose**: Create ADR in `Proposed` state
2. **Discuss**: Team reviews in PR
3. **Decide**: Tech lead moves to `Accepted` or `Rejected`
4. **Implement**: Code follows the decision
5. **Supersede**: If overturned later, mark old as `Superseded` and link new

## Naming Convention

- Files: `NNN-short-title.md` (zero-padded 3 digits)
- Title: Imperative mood ("Use X", "Adopt Y", "Avoid Z")