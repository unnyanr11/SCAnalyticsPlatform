# Contributing to SC Analytics Platform

Thank you for your interest in contributing! This guide explains how to
set up your development environment, follow our coding standards, and
submit changes.

---

## ⚠️ Non-Negotiable Rule

> **This project is analytics-only.**
>
> Pull requests that introduce any form of gameplay automation — including
> auto-clicking, auto-buying, auto-selling, auto-production, or any
> account manipulation — will be **immediately rejected and closed**.

---

## Getting Started

```bash
# Clone the repo
git clone https://github.com/unnyanr11/SCAnalyticsPlatform.git
cd SCAnalyticsPlatform

# Run full setup
bash scripts/setup.sh

# Start development servers
bash scripts/dev.sh
```

---

## Project Structure

```
SCAnalyticsPlatform/
├── extension/        React + TypeScript + Manifest V3 browser extension
├── backend/          FastAPI + Python AI analytics server
├── shared/           Shared TypeScript types and constants
├── docs/             Documentation
├── scripts/          Developer utility scripts
└── .github/          CI/CD workflows and PR templates
```

---

## Development Workflow

1. **Branch naming**: `feat/short-description`, `fix/issue-description`, `docs/update-name`
2. **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/)
   - `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
3. **Lint before pushing**: `bash scripts/lint.sh`
4. **Tests**: `bash scripts/test.sh`
5. **PR**: Fill out the PR template completely, especially the Analytics Compliance checklist

---

## Code Standards

### Backend (Python)
- **Formatter**: `ruff format` (Black-compatible)
- **Linter**: `ruff check`
- **Type checker**: `mypy`
- **Test framework**: `pytest` + `pytest-asyncio`
- Minimum Python: **3.12**

### Extension (TypeScript)
- **Linter**: ESLint with `@typescript-eslint`
- **Formatter**: Prettier
- **Type checker**: `tsc --noEmit`
- Minimum Node.js: **20 LTS**

---

## Security

- Never commit real `.env` files
- All API calls must be read-only
- Rate-limit all polling (minimum 500ms between requests)
- Do not store or transmit user credentials
