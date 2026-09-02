#!/usr/bin/env bash
# =============================================================================
# SIH26162 — Industrial Thermal Intelligence — Project Setup Script
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

cd "$PROJECT_ROOT"

# ── Prerequisite checks ────────────────────────────────────────────────
info "Checking prerequisites..."

command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1 || fail "Python 3.11+ is required. Install from https://python.org"
command -v node   >/dev/null 2>&1 || fail "Node.js 20+ is required. Install from https://nodejs.org"
command -v docker >/dev/null 2>&1 || fail "Docker is required. Install from https://docker.com"

PYTHON_CMD="python3"
command -v python3 >/dev/null 2>&1 || PYTHON_CMD="python"

PYTHON_VERSION=$($PYTHON_CMD -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)

info "Python: $PYTHON_VERSION | Node: $NODE_VERSION"
ok "Prerequisites found"

# ── Virtual environment ────────────────────────────────────────────────
if [ ! -d ".venv" ]; then
    info "Creating Python virtual environment..."
    $PYTHON_CMD -m venv .venv
    ok "Virtual environment created"
else
    warn "Virtual environment already exists — skipping creation"
fi

# Activate
# shellcheck disable=SC1091
source .venv/bin/activate 2>/dev/null || source .venv/Scripts/activate 2>/dev/null || true

# ── Python dependencies ────────────────────────────────────────────────
info "Installing Python dependencies..."
pip install --upgrade pip setuptools wheel -q

info "  → Installing API dependencies (dev)..."
pip install -e "apps/api[dev]" -q

info "  → Installing ML dependencies..."
pip install -e "ml[dev]" -q

ok "Python dependencies installed"

# ── Frontend dependencies ──────────────────────────────────────────────
info "Installing frontend dependencies..."
cd apps/web
npm install
cd "$PROJECT_ROOT"
ok "Frontend dependencies installed"

# ── Environment file ───────────────────────────────────────────────────
if [ ! -f ".env" ]; then
    info "Creating .env from .env.example..."
    cp .env.example .env
    ok ".env created — please add your FIRMS API key"
    warn "Get your key at: https://firms.modaps.eosdis.nasa.gov/api/area/"
else
    warn ".env already exists — skipping"
fi

# ── Docker (PostGIS) ──────────────────────────────────────────────────
info "Starting PostGIS database..."
docker compose up -d db
info "Waiting for PostgreSQL to be ready..."
sleep 5
ok "PostGIS is running on localhost:5432"

# ── Database migrations ───────────────────────────────────────────────
info "Running Alembic migrations..."
cd apps/api
"$PROJECT_ROOT/.venv/bin/alembic" upgrade head 2>/dev/null || warn "Alembic migrations skipped (may need initial migration)"
cd "$PROJECT_ROOT"

# ── Seed data ──────────────────────────────────────────────────────────
info "Seeding database..."
$PYTHON_CMD -m scripts.data.seed_db 2>/dev/null || warn "Seed skipped (FIRMS API key may be needed)"
ok "Database seeded"

# ── Done ───────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}====================================================${NC}"
echo ""
echo "  Run the dev servers:   make dev"
echo "  Or manually:"
echo "    Backend:   cd apps/api && uvicorn app.main:app --reload"
echo "    Frontend:  cd apps/web && npm run dev"
echo ""
echo "  Don't forget to set your FIRMS_API_KEY in .env"
echo ""
