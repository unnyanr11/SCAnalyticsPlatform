# Changelog

All notable changes to SC Analytics Platform are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- Complete monorepo foundation with React/TypeScript extension and FastAPI backend
- Manifest V3 extension scaffold with content script, service worker, and popup
- FastAPI application with `/health`, `/market/ingest`, `/analytics/*`, `/predictions/*` routes
- SQLAlchemy async models for `products` and `market_prices`
- Pydantic schemas for market data ingestion and API responses
- Redis client with async connection pooling
- Alembic migration scaffold
- Shared TypeScript types (`MarketItem`, `ResourceInfo`, `PricePrediction`, etc.)
- Shared API endpoint constants for Sim Companies and SimcoTools
- Market API service with rate-limited fetch helpers
- WebSocket monitor for passive observation of game traffic
- GitHub Actions CI pipeline (backend + extension lint/test/build)
- GitHub Actions CodeQL security scan
- PR template with Analytics Compliance checklist
- Developer scripts: `setup.sh`, `dev.sh`, `lint.sh`, `test.sh`
- Full documentation: README, architecture, API reference, data sources, compliance

---

## [0.1.0] — Foundation

> Initial monorepo scaffold. No production features yet.
> All AI analysis pipelines are stubbed and marked TODO.
