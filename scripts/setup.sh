#!/usr/bin/env bash
# SC Analytics Platform — Full Development Setup Script
# Run: bash scripts/setup.sh

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }

log_info "=== SC Analytics Platform — Setup ==="

# ------------------------------------------------------------------
# 1. Python backend
# ------------------------------------------------------------------
log_info "Setting up Python virtual environment…"
cd backend

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  log_ok "Virtual environment created at backend/.venv"
else
  log_warn "Virtual environment already exists — skipping creation"
fi

source .venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
log_ok "Python dependencies installed"

if [ ! -f ".env" ]; then
  cp .env.example .env
  log_ok "backend/.env created from .env.example"
  log_warn "Review backend/.env and update secrets before running"
fi

cd ..

# ------------------------------------------------------------------
# 2. Node.js extension
# ------------------------------------------------------------------
log_info "Setting up Node.js extension…"
cd extension

if command -v pnpm &>/dev/null; then
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
elif command -v npm &>/dev/null; then
  npm install
else
  log_warn "Neither pnpm nor npm found — skipping Node.js setup"
fi
log_ok "Node.js dependencies installed"

if [ ! -f ".env" ]; then
  cp .env.example .env
  log_ok "extension/.env created from .env.example"
fi

cd ..

log_ok "=== Setup complete. Run: bash scripts/dev.sh to start ==="
