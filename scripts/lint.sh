#!/usr/bin/env bash
# SC Analytics Platform — Lint All Code
# Run: bash scripts/lint.sh

set -euo pipefail

echo "=== Linting Backend (ruff + mypy) ==="
cd backend
source .venv/bin/activate 2>/dev/null || true
ruff check app/ tests/
mypy app/ --ignore-missing-imports
cd ..

echo "=== Linting Extension (ESLint + TypeScript) ==="
cd extension
npx eslint src/ content/ background/ services/ websocket/ popup/ --ext .ts,.tsx
npx tsc --noEmit
cd ..

echo "=== All linting passed ==="
