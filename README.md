# SCAnalyticsPlatform

> AI-powered market intelligence browser extension for [Sim Companies](https://www.simcompanies.com)

---

## ⚠️ Compliance Notice

This project is **strictly an analytics, forecasting, and decision-support platform**.

The extension **NEVER** automates gameplay. The following are permanently prohibited:

- Auto-clicking
- Auto-buying or auto-selling
- Auto-production
- Gameplay bots
- Account automation or manipulation
- Automatic market actions

---

## 🎯 What It Does

SCAnalyticsPlatform helps Sim Companies players:

- **Maximize profits** via AI-powered profitability forecasting
- **Detect market opportunities** before they disappear
- **Predict shortages** using inventory depletion analytics
- **Optimize production chains** based on current economy phase
- **Understand market behavior** with realtime heatmaps and trend analysis
- **Make smarter decisions** with an AI strategy assistant

The experience is inspired by Bloomberg Terminal, TradingView, and professional trading dashboards — built specifically for Sim Companies.

---

## 🗂️ Repository Structure

```
SCAnalyticsPlatform/
│
├── extension/          # Browser extension (React + TypeScript + Tailwind + MV3)
│   ├── manifest.json
│   ├── background/
│   ├── content/
│   ├── popup/
│   ├── overlays/
│   ├── ai/
│   ├── services/
│   ├── charts/
│   ├── websocket/
│   ├── storage/
│   ├── utils/
│   └── assets/
│
├── backend/            # FastAPI + PostgreSQL + Redis
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── ai/
│   │   └── core/
│   ├── migrations/
│   ├── tests/
│   └── requirements.txt
│
├── shared/             # Shared TypeScript types and constants
│   ├── types/
│   └── constants/
│
├── docs/               # Project documentation
│   ├── architecture.md
│   ├── api-reference.md
│   ├── data-sources.md
│   ├── compliance.md
│   └── features/
│
├── scripts/
└── .github/
    └── workflows/
```

---

## 🧰 Tech Stack

### Browser Extension
| Layer | Technology |
|---|---|
| UI Framework | React 18 + TypeScript |
| Styling | Tailwind CSS v3 |
| Extension API | Manifest V3 |
| Charts | TradingView Lightweight Charts + Recharts |
| Animation | Framer Motion |
| Build | Vite |

### Backend
| Layer | Technology |
|---|---|
| API Server | FastAPI (Python 3.11+) |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| ORM | SQLAlchemy 2 + Alembic |

### AI / ML
| Library | Purpose |
|---|---|
| pandas | Data manipulation |
| scikit-learn | Clustering, anomaly detection |
| Prophet | Time-series forecasting |
| XGBoost | Profitability prediction |

---

## 📡 Data Sources

The extension observes (never modifies) existing API traffic:

- Sim Companies official APIs
- SimcoTools APIs (`https://simcotools.app/api/v3/resources`)
- Economy phase endpoints (`https://api.simcotools.com/v1/realms/0/phases`)

See [`docs/data-sources.md`](docs/data-sources.md) for the full reference.

---

## 🚀 Getting Started

### Extension
```bash
cd extension
npm install
npm run dev
```
Load `extension/dist` in Chrome via `chrome://extensions` → Load unpacked.

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

---

## 📋 Features Roadmap

- [x] Feature 1 — Live Market Intelligence Overlay
- [ ] Feature 2 — AI Profit Predictor
- [ ] Feature 3 — Shortage Detection System
- [ ] Feature 4 — Market Heatmap
- [ ] Feature 5 — Production Optimizer
- [ ] Feature 6 — Arbitrage Finder
- [ ] Feature 7 — Economy Phase Strategy Engine
- [ ] Feature 8 — AI Strategy Assistant
- [ ] Feature 9 — Portfolio Tracking
- [ ] Feature 10 — Smart Alert System

---

## 📄 License

MIT — see [LICENSE](LICENSE)
