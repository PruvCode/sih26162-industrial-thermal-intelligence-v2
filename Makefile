.PHONY: help setup dev test lint format db-up db-down db-migrate db-upgrade seed frontend backend ml clean docker-up docker-down check

help: ## Show this help message
	@echo "SIH26162 - Industrial Thermal Intelligence"
	@echo "==========================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ──────────────────────────────────────────────
# Project Setup
# ──────────────────────────────────────────────

setup: ## Initialise project (create venv, install deps, init DB)
	python -m venv .venv
	./.venv/Scripts/pip install -e "apps/api[dev]"
	./.venv/Scripts/pip install -e "ml[dev]"
	cd apps/web && npm install
	$(MAKE) db-up
	$(MAKE) db-migrate
	$(MAKE) db-upgrade
	$(MAKE) seed

# ──────────────────────────────────────────────
# Development Servers
# ──────────────────────────────────────────────

dev: ## Run all services in dev mode (backend + frontend)
	@echo "Starting backend…"
	start /b powershell -Command "cd apps/api && ../../.venv/Scripts/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
	@echo "Starting frontend…"
	start powershell -Command "cd apps/web && npm run dev"

backend: ## Run FastAPI backend only
	cd apps/api && ../../.venv/Scripts/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend: ## Run Next.js frontend only
	cd apps/web && npm run dev

ml: ## Run MLflow tracking server
	./.venv/Scripts/python -m mlflow server --host 0.0.0.0 --port 5000

# ──────────────────────────────────────────────
# Testing
# ──────────────────────────────────────────────

test: ## Run all tests (pytest + npm test)
	./.venv/Scripts/python -m pytest apps/api/tests ml/tests -v --tb=short
	cd apps/web && npm test

# ──────────────────────────────────────────────
# Code Quality
# ──────────────────────────────────────────────

lint: ## Lint Python (ruff) and JS/TS (eslint)
	./.venv/Scripts/python -m ruff check apps/ ml/
	cd apps/web && npm run lint

format: ## Format Python (ruff + black) and JS/TS (prettier)
	./.venv/Scripts/python -m ruff format apps/ ml/
	cd apps/web && npm run format

check: lint test ## Run lint + tests

# ──────────────────────────────────────────────
# Database
# ──────────────────────────────────────────────

db-up: ## Start PostGIS container
	docker compose up -d db
	@echo "Waiting for Postgres…"
	powershell -Command "Start-Sleep -Seconds 5"

db-down: ## Stop PostGIS container
	docker compose down

db-migrate: ## Generate Alembic migration
	cd apps/api && ../../.venv/Scripts/alembic revision --autogenerate -m "$(msg)"

db-upgrade: ## Apply Alembic migrations
	cd apps/api && ../../.venv/Scripts/alembic upgrade head

seed: ## Seed database with FIRMS hotspot data
	./.venv/Scripts/python -m apps.api.scripts.seed_firms

# ──────────────────────────────────────────────
# Docker
# ──────────────────────────────────────────────

docker-up: ## Start all services via Docker Compose
	docker compose up --build -d

docker-down: ## Stop and remove all Docker Compose services
	docker compose down -v --remove-orphans

# ──────────────────────────────────────────────
# Cleanup
# ──────────────────────────────────────────────

clean: ## Remove caches, build artifacts, and __pycache__
	find . -type d -name __pycache__ -exec rm -rf {} + 2>nul || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>nul || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>nul || true
	rm -rf apps/web/.next apps/web/out ml/artifacts/*.pkl dist build *.egg-info
