# Contributing to SIH26162

Thank you for contributing to the Industrial Thermal Intelligence Platform! This document outlines our development workflow, standards, and processes.

## Table of Contents
1. [Code of Conduct](#code-of-conduct)
2. [Development Workflow](#development-workflow)
3. [Branch Strategy](#branch-strategy)
4. [Commit Conventions](#commit-conventions)
5. [Pull Request Process](#pull-request-process)
6. [Code Standards](#code-standards)
7. [Testing Requirements](#testing-requirements)
8. [Documentation](#documentation)
9. [Team Roles](#team-roles)

---

## Code of Conduct

This project follows our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

---

## Development Workflow

### 1. Setup
```bash
# Clone
git clone git@github.com:PruvCode/sih26162-industrial-thermal-intelligence.git
cd sih26162-industrial-thermal-intelligence

# Full setup (installs all deps, starts DB, runs migrations, seeds data)
make setup

# Start development
make dev
# Or individually:
make backend    # Terminal 1: FastAPI on :8000
make frontend   # Terminal 2: Next.js on :3000
```

### 2. Daily Workflow
```bash
# Start day: sync with develop
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/your-feature-name

# Work... commit often with conventional commits
git add .
git commit -m "feat(ingestion): add FIRMS VIIRS client with retry logic"

# Push and create PR
git push origin feature/your-feature-name
# Open PR via GitHub UI
```

### 3. Code Quality (Run Before Push)
```bash
# Format all code
make format

# Lint all code
make lint

# Type check
make typecheck

# Run tests
make test
```

---

## Branch Strategy

### Protected Branches
| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | Production-ready releases | Required PR, 1 approval, CI pass, no direct push |
| `develop` | Integration branch | Required PR, CI pass, no direct push |

### Feature Branches
```
feature/<short-description>     # New functionality
fix/<short-description>         # Bug fixes
research/<topic>                # Spikes, experiments
docs/<section>                  # Documentation updates
refactor/<area>                 # Code improvements
chore/<task>                    # Maintenance, deps, config
```

### Examples
```
feature/firms-ingestion-pipeline
fix/event-deduplication-bug
research/sentinel3-integration
docs/api-documentation
refactor/ml-feature-engineering
chore/update-dependencies
```

### Release Tags
```
v0.1.0    # First demo-ready release
v0.2.0    # Post-SIH improvements
v1.0.0    # Production release
```

---

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no logic change |
| `refactor` | Code restructuring |
| `perf` | Performance improvement |
| `test` | Adding/updating tests |
| `chore` | Maintenance, deps, build |
| `ci` | CI/CD changes |

### Scopes
| Scope | Area |
|-------|------|
| `api` | FastAPI backend |
| `web` | Next.js frontend |
| `ml` | ML pipeline |
| `gis` | GIS utilities |
| `db` | Database/migrations |
| `ingestion` | Data ingestion |
| `ui` | Frontend components |
| `auth` | Authentication |
| `config` | Configuration |

### Examples
```
feat(api): add event evidence endpoint
fix(web): resolve map clustering flicker
docs(ml): update feature engineering guide
refactor(gis): optimize spatial join query
test(api): add integration tests for events API
chore(deps): update xgboost to 2.0
ci: add ML model validation to pipeline
```

### Breaking Changes
```
feat(api)!: change event response format

BREAKING CHANGE: event.geometry now returns GeoJSON object instead of [lon, lat] array
```

---

## Pull Request Process

### 1. Before Opening PR
- [ ] Branch from `develop`
- [ ] Run `make format lint typecheck test`
- [ ] Update documentation if needed
- [ ] Add tests for new functionality
- [ ] Self-review your diff

### 2. PR Template
Use the [PR template](.github/PULL_REQUEST_TEMPLATE.md). Include:
- **Description**: What and why
- **Type**: Feature/Fix/Docs/Refactor
- **Testing**: How you tested
- **Screenshots**: For UI changes
- **Breaking Changes**: If any

### 3. Review Requirements
- [ ] CI passes (GitHub Actions)
- [ ] At least 1 approval from team member
- [ ] No unresolved conversations
- [ ] Branch up to date with `develop`

### 4. Merge Strategy
- **Squash and merge** (default) — keeps history clean
- **Rebase and merge** — for feature branches with many commits
- **Never merge directly to `main`** — only via release PR from `develop`

### 5. After Merge
- Delete branch (GitHub auto-prompts)
- Update local: `git checkout develop && git pull`
- Deploy to staging (auto via CI)

---

## Code Standards

### Python (Backend + ML)
- **Formatter**: `black` (line length 100)
- **Linter**: `ruff` (replaces flake8, isort, pyupgrade)
- **Type Checker**: `mypy` (strict mode)
- **Imports**: `isort` (via ruff) — stdlib, third-party, local
- **Docstrings**: Google style for public APIs
- **Version**: Python 3.11+

```python
# Good
from typing import Optional
import numpy as np
from app.models import ThermalEvent

def find_nearest_site(event: ThermalEvent, max_km: float = 10.0) -> Optional[IndustrialSite]:
    """Find nearest industrial site within max_km.
    
    Args:
        event: Thermal event to match.
        max_km: Maximum search radius in kilometers.
        
    Returns:
        Nearest site or None if not found.
    """
    ...
```

### TypeScript (Frontend)
- **Formatter**: `prettier` (single quotes, trailing commas)
- **Linter**: `eslint` (Airbnb + TypeScript + React hooks)
- **Types**: Strict mode, no `any`, explicit generics
- **Components**: Functional + hooks, `React.FC` avoided
- **State**: TanStack Query for server, Zustand for client (if needed)

```typescript
// Good
interface EventProps {
  event: ThermalEvent;
  onSelect: (id: string) => void;
}

export const EventCard: React.FC<EventProps> = ({ event, onSelect }) => {
  const severity = getSeverityFromClass(event.classification?.class);
  
  return (
    <Card className={severity.bgClass} onClick={() => onSelect(event.id)}>
      ...
    </Card>
  );
};
```

### SQL (Migrations)
- **Naming**: `YYYYMMDD_HHMMSS_description.sql`
- **Up/Down**: Always provide rollback
- **Idempotent**: Use `IF NOT EXISTS`, `DROP IF EXISTS`
- **Comments**: Explain *why*, not *what*

```sql
-- Good
-- Add cluster_id to thermal_events for persistence tracking
-- This enables temporal clustering analysis without schema change
ALTER TABLE thermal_events 
ADD COLUMN IF NOT EXISTS cluster_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_thermal_events_cluster 
ON thermal_events (cluster_id) WHERE cluster_id IS NOT NULL;
```

### Git
- **Line endings**: LF (enforced by `.gitattributes`)
- **No secrets**: Pre-commit scans for keys/tokens
- **File size**: <1MB (use Git LFS for data)

---

## Testing Requirements

### Coverage Targets
| Area | Target |
|------|--------|
| Backend (API + Services) | 80% |
| Frontend (Components + Hooks) | 70% |
| ML (Feature Eng + Models) | 70% |
| GIS (Spatial Utils) | 80% |

### Test Types
| Type | Location | Command |
|------|----------|---------|
| Unit | `apps/api/tests/`, `apps/web/tests/`, `ml/tests/` | `make test` |
| Integration | `tests/integration/` | `make test-integration` |
| E2E | `tests/e2e/` (Playwright) | `make test-e2e` |

### Python Testing
```python
# pytest with async support
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_get_events(client: AsyncClient):
    response = await client.get("/events?bbox=72,18,74,20&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "features" in data
    assert len(data["features"]) <= 10
```

### Frontend Testing
```typescript
// React Testing Library + Vitest
import { render, screen } from '@testing-library/react';
import { EvidencePanel } from '@/components/panels/EvidencePanel';

test('renders positive factors with weights', () => {
  render(<EvidencePanel eventId="test" onClose={jest.fn()} />);
  expect(screen.getByText('Supporting Evidence')).toBeInTheDocument();
  expect(screen.getByText('proximity to industrial')).toBeInTheDocument();
});
```

---

## Documentation

### When to Update Docs
- New API endpoint → `docs/api/README.md`
- New ML feature → `docs/architecture/ml-architecture.md`
- New GIS function → `docs/architecture/data-flow.md`
- Architecture decision → `docs/decisions/NNN-title.md`
- User-facing change → `README.md`

### Documentation Standards
- **Audience**: Technical team + future maintainers
- **Style**: Concise, examples over explanations
- **Format**: Markdown with code blocks
- **Diagrams**: Mermaid.js (renders in GitHub)

---

## Team Roles & Ownership

| Role | Primary Area | Review Authority |
|------|--------------|------------------|
| **Tech Lead** | Architecture, cross-cutting | All PRs (final) |
| **Data/GIS Engineer** | `ml/src/ingestion/`, `gis/`, `database/` | Data pipeline, spatial |
| **ML Engineer** | `ml/src/features/`, `ml/src/models/`, `ml/src/explainability/` | ML pipeline, models |
| **Backend Engineer** | `apps/api/`, `database/migrations/` | API, database, auth |
| **Frontend Engineer** | `apps/web/`, `packages/ui/` | UI, map, state management |
| **Research/QA** | `docs/research/`, `tests/`, labeling | Research, testing, labels |

### Pair Programming Recommendations
- **ML + Backend**: Inference API integration
- **Frontend + Backend**: API contract (shared types)
- **GIS + ML**: Feature engineering validation
- **QA + All**: Test planning, bug triage

---

## Getting Help

- **Technical questions**: GitHub Discussions or team Slack
- **Bug reports**: GitHub Issues (use bug template)
- **Feature requests**: GitHub Issues (use feature template)
- **Research tasks**: GitHub Issues (use research template)
- **Urgent**: Tag `@tech-lead` in Slack

---

## Recognition

Contributors are recognized in:
- `AUTHORS.md` (auto-generated from commits)
- Release notes
- SIH submission credits

---

*Last Updated: 2024-01-15 | For SIH26162 Team Internal Use*