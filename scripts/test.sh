#!/usr/bin/env bash
# SC Analytics Platform — Run All Tests
# Run: bash scripts/test.sh

set -euo pipefail

echo "=== Running Backend Tests ==="
cd backend
source .venv/bin/activate 2>/dev/null || true
pytest tests/ -v --tb=short --asyncio-mode=auto
cd ..

echo "=== All tests passed ==="
