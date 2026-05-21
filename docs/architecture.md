# Architecture — SC Analytics Platform

## Overview

SC Analytics Platform is a monorepo containing:

| Package | Technology | Purpose |
|---|---|---|
| `extension/` | React + TypeScript + MV3 | Browser extension UI and overlays |
| `backend/` | FastAPI + PostgreSQL + Redis | AI analytics engine and REST API |
| `shared/` | TypeScript types + constants | Shared contracts between extension and backend |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SimCompanies (Browser)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               Extension (MV3)                            │   │
│  │                                                          │   │
│  │  Content Script ──► API Interceptor                      │   │
│  │       │                    │                             │   │
│  │       ▼                    ▼                             │   │
│  │  UI Overlays         Background SW                       │   │
│  │  (React/Tailwind)         │                              │   │
│  │                           │ REST / WebSocket             │   │
│  └───────────────────────────┼──────────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                            │
│                                                                 │
│  API Router                                                     │
│  ├─ /market/*     Market price ingestion + scoring              │
│  ├─ /ai/*         Predictions, forecasting, assistant           │
│  ├─ /economy/*    Phase detection + strategy engine             │
│  ├─ /production/* Optimizer                                     │
│  ├─ /alerts/*     Smart alert system                            │
│  └─ /portfolio/*  Portfolio tracker                             │
│                                                                 │
│  Services                                                       │
│  ├─ api_provider.py     ── SimCo + SimcoTools fetcher           │
│  ├─ data_normalizer.py  ── Schema unification                   │
│  ├─ ai_engine.py        ── XGBoost + Prophet + sklearn          │
│  └─ alert_engine.py     ── Shortage + spike detection           │
│                                                                 │
│  Storage                                                        │
│  ├─ PostgreSQL  ── Historical prices, predictions, alerts       │
│  └─ Redis       ── API response cache, rate limiting            │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              External Data Sources (READ-ONLY)                  │
│                                                                 │
│  SimCompanies API    simcotools.app API    api.simcotools.com   │
│  /api/v2/market/*    /api/v3/resources     /v1/realms/*/phases  │
│  /api/v4/*/enc...    /api/v3/resources/*                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Extension Architecture (MV3)

```
extension/
├── manifest.json            MV3 manifest
├── background/
│   └── service-worker.ts    Background service worker
│       ├─ API polling scheduler
│       ├─ WebSocket monitor
│       ├─ Alert dispatcher
│       └─ Extension↔Backend bridge
├── content/
│   ├─ interceptor.ts        Intercepts fetch/XHR from SimCo game
│   ├─ observer.ts           MutationObserver for DOM changes
│   └─ injector.ts           Injects overlay components
├── overlays/
│   ├─ MarketBadge.tsx       Profitability + direction badge
│   ├─ ShortageWarning.tsx   Shortage alert overlay
│   └─ VolatilityIndicator.tsx
├── popup/
│   └─ App.tsx               Extension popup dashboard
├── ai/
│   └─ scorer.ts             Client-side score calculation
├── services/
│   ├─ api.ts                Backend API client
│   └─ storage.ts            Chrome storage helpers
├── charts/
│   └─ PriceChart.tsx        TradingView lightweight charts
└── websocket/
    └─ monitor.ts            WebSocket traffic observer
```

---

## Data Flow

### Market data ingestion

```
SimCo game page
  │
  ├─ Content script intercepts fetch()/XHR responses
  │     (game makes requests; we observe the responses)
  │
  ├─ Intercepted data → Background service worker
  │
  ├─ Background SW → POST /api/v1/market/prices (local backend)
  │
  └─ Backend stores in PostgreSQL + updates Redis cache
```

### AI scoring pipeline

```
Historical prices (PostgreSQL)
  │
  ├─ Feature engineering (pandas)
  ├─ Price direction forecast (Prophet)
  ├─ Margin prediction (XGBoost)
  ├─ Anomaly detection (IsolationForest)
  │
  └─ Scored result → Redis cache → Extension overlay
```

---

## Database Schema

See `backend/app/models/market.py` for the full ORM definitions.

| Table | Purpose |
|---|---|
| `products` | Resource/product catalogue |
| `market_prices` | Time-series price snapshots |
| `ai_predictions` | AI model outputs per product |
| `economy_phases` | Economy phase history |
| `alerts` | Generated shortage/spike alerts |
| `watchlist_entries` | User watchlists |
| `volatility_metrics` | Rolling volatility stats |

---

## Security & Compliance

See `docs/compliance.md` for the full compliance charter.

Key architecture rules:
- **No automation**: the extension never initiates game actions
- **Read-only interceptor**: content script uses `window.fetch` proxy and XHR observer to read responses only
- **No credential storage**: the extension never captures or stores login credentials
- **Rate limiting**: all outbound API calls are token-bucket rate-limited
- **No scraping loops**: data collection relies on intercepted existing requests, not aggressive polling
