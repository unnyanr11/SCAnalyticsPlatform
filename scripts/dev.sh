#!/usr/bin/env bash
# scripts/dev.sh
# Start the SC Analytics Platform development environment.
# Launches backend (FastAPI) and extension (Vite) in parallel.
#
# Usage:
#   ./scripts/dev.sh          — start everything
#   ./scripts/dev.sh backend  — backend only
#   ./scripts/dev.sh ext      — extension only

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd .. && pwd)"
BACKEND="$ROOT/backend"
EXTENSION="$ROOT/extension"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[dev]${NC} $*"; }
ok()   { echo -e "${GREEN}[dev]${NC} $*"; }
error(){ echo -e "${RED}[dev]${NC} $*" >&2; }

# ---------------------------------------------------------------------------
# Prerequisite checks
# ---------------------------------------------------------------------------

check_prereqs() {
  local missing=()
  command -v python3 >/dev/null 2>&1 || missing+=("python3")
  command -v node    >/dev/null 2>&1 || missing+=("node")
  command -v npm     >/dev/null 2>&1 || missing+=("npm")
  if [[ ${#missing[@]} -gt 0 ]]; then
    error "Missing prerequisites: ${missing[*]}"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Backend
# ---------------------------------------------------------------------------

start_backend() {
  log "Starting FastAPI backend..."

  cd "$BACKEND"

  # Create venv if absent
  if [[ ! -d .venv ]]; then
    log "Creating Python virtual environment..."
    python3 -m venv .venv
  fi

  # shellcheck disable=SC1091
  source .venv/bin/activate

  log "Installing backend dependencies..."
  pip install -q -r requirements.txt

  # Copy .env.example → .env if absent
  if [[ ! -f .env ]]; then
    cp .env.example .env
    ok ".env created from .env.example — update DATABASE_URL and REDIS_URL before use"
  fi

  ok "Backend ready — starting on http://localhost:8000"
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}

# ---------------------------------------------------------------------------
# Extension
# ---------------------------------------------------------------------------

start_extension() {
  log "Starting extension dev server (Vite)..."

  cd "$EXTENSION"

  if [[ ! -d node_modules ]]; then
    log "Installing extension dependencies..."
    npm install
  fi

  if [[ ! -f .env ]]; then
    cp .env.example .env
    ok "extension .env created from .env.example"
  fi

  ok "Extension Vite dev server starting..."
  npm run dev
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

check_prereqs

case "${1:-all}" in
  backend)
    start_backend
    ;;
  ext|extension)
    start_extension
    ;;
  all|"")
    log "Starting all services in parallel..."
    # Run both in background, trap exit to kill both
    start_backend  &
    BACKEND_PID=$!
    start_extension &
    EXT_PID=$!

    trap 'log "Shutting down..."; kill $BACKEND_PID $EXT_PID 2>/dev/null; exit 0' INT TERM

    ok "\nAll services running:"
    ok "  Backend:   http://localhost:8000"
    ok "  API docs:  http://localhost:8000/docs"
    ok "  Extension: load dist/ as unpacked extension in Chrome"
    ok "\nPress Ctrl+C to stop all services."

    wait
    ;;
  *)
    error "Unknown argument: $1"
    echo "Usage: $0 [all|backend|ext]"
    exit 1
    ;;
esac
