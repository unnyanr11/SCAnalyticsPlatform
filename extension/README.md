# SC Analytics Platform — Browser Extension

Chrome Extension (Manifest V3) providing **read-only AI market intelligence** for [Sim Companies](https://www.simcompanies.com).

> ⚠️ **Strictly analytics-only.** This extension never automates gameplay, clicks, buys, sells, or any account action.

---

## Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Extension   | Chrome MV3 + TypeScript           |
| UI          | React 18 + Tailwind CSS           |
| Build       | Vite 5                            |
| Background  | Service Worker (chrome.alarms)    |
| Storage     | chrome.storage.local              |
| Interceptor | Patched `fetch` + `XMLHttpRequest`|
| WS Monitor  | Patched `WebSocket`               |

---

## Quick Start

```bash
# 1. Install dependencies
cd extension
npm install

# 2. Build for development (watch mode)
npm run dev

# 3. Load in Chrome
# chrome://extensions → Developer mode ON → Load unpacked → select /extension folder

# 4. Navigate to https://www.simcompanies.com
# The extension activates automatically
```

---

## Folder Structure

```
extension/
├── manifest.json              # MV3 manifest
├── popup.html                 # Popup entry
├── vite.config.ts             # Build config
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── src/
    ├── background/            # Service worker
    ├── content/               # Content script entry
    ├── overlays/              # DOM badge injector
    ├── popup/                 # React popup app
    ├── services/              # API interceptor
    ├── websocket/             # WebSocket monitor
    ├── storage/               # chrome.storage wrapper
    ├── hooks/                 # React hooks
    ├── types/                 # TypeScript types
    ├── utils/                 # Helpers & constants
    └── styles/                # CSS
```

---

## Architecture

```
Sim Companies Page
  │
  ├─ Content Script (content/index.ts)
  │     ├─ ApiInterceptor   — patches fetch/XHR, read-only
  │     ├─ WebSocketMonitor — observes WS frames, read-only
  │     └─ OverlayInjector  — injects signal badges into DOM
  │
  └─ ←→ Message Bus (chrome.runtime)
          │
          └─ Background Service Worker (background/service-worker.ts)
                ├─ Cache manager   (chrome.storage.local)
                ├─ Alarm scheduler (cache eviction, phase polling)
                └─ Backend relay   (POST to FastAPI AI server)

Popup (popup/PopupApp.tsx)
  ├─ Dashboard — economy phase, stats, component status
  ├─ Signals   — per-resource market signals
  ├─ Alerts    — shortage / spike / opportunity history
  └─ Settings  — realm, polling, confidence threshold, backend URL
```

---

## Compliance

- No automated clicks, no buy/sell/produce automation
- No account manipulation
- All network calls are read-only analytics
- Strictly adheres to Sim Companies Terms of Service
