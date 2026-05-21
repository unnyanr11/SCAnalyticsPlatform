# `src/services/` — API Service Layer

All external data access for SCAnalyticsPlatform lives here.
Overlay, AI, and dashboard components **must only import from `api_service.js`** —
never from individual adapter files.

---

## Module Map

```
services/
├── schema.js             Unified data types + ok()/err() result wrappers
├── cache.js              In-memory TTL cache (singleton)
├── api_client.js         Low-level fetch: retry, back-off, timeout, concurrency guard
├── normalizers.js        Raw API JSON → unified schema shapes
├── simco_adapter.js      SimCompanies official API adapter
├── simcotools_adapter.js SimcoTools third-party API adapter
├── provider_registry.js  Fallback chain + per-provider circuit breaker
└── api_service.js        ✅ Public interface — import this in your components
```

---

## Usage

```js
import * as API from '../services/api_service.js';

// Single market fetch
const result = await API.market(4);          // productId=4 (steel), realm=0
if (result.ok) {
  console.log(result.data.vwap);             // volume-weighted average price
  console.log(result.data.lowestAsk);
  console.log(result.data.offers);           // sorted by price ascending
}

// Economy phase
const phase = await API.economyPhase();
if (phase.ok) {
  // phase.data: { phaseCode, phaseName, multiplier, fetchedAt }
  console.log(phase.data.phaseName);         // "Boom" | "Recession" | …
}

// Batch market fetch for heatmap
const markets = await API.marketBatch([1,2,3,4,5,6], 0, 4);
// markets: { [productId]: MarketSnapshot | null }

// Bootstrap everything needed for the heatmap
const boot = await API.heatmapBootstrap();
// boot.data: { phase, retailInfo[], resources[] }

// Diagnostics
console.log(API.diagnostics());
// { cache: { size, hits, misses, hitRate }, providers: { simco: {…}, simcotools: {…} } }
```

---

## Data Flow

```
Component
  └── api_service.js   (validate + log)
        └── provider_registry.js   (fallback chain + circuit breaker)
              ├── simco_adapter.js         → SimCompanies API
              └── simcotools_adapter.js    → SimcoTools API
                    └── api_client.js      (retry + back-off + timeout)
                          └── normalizers.js  (raw JSON → unified schema)
                                └── cache.js
```

---

## Endpoint Reference

| Category       | Provider    | Endpoint |
|---|---|---|
| Market offers  | SimCo       | `/api/v2/market/{id}?realm={r}` |
| Encyclopedia   | SimCo       | `/api/v4/pt/{realm}/encyclopedia/resources/` |
| Economy Phase  | SimCo       | `/api/v4/{realm}/gamephase/` |
| Economy Phase  | SimcoTools  | `https://api.simcotools.com/v1/realms/{r}/phases` |
| Retail Info    | SimCo       | `/api/v4/{realm}/resources-retail-info/` |
| Resource Stats | SimcoTools  | `https://simcotools.app/api/v3/resources` |
| Price History  | SimcoTools  | `https://api.simcotools.com/v1/realms/{r}/resources/{id}/history` |
| Market Mirror  | SimcoTools  | `https://api.simcotools.com/v1/realms/{r}/resources/{id}/market` |

---

## Error Codes

| Code | Meaning |
|---|---|
| `RATE_LIMITED`         | 429 received; Retry-After respected |
| `SERVER_ERROR`         | 5xx after all retries exhausted |
| `CLIENT_ERROR`         | 4xx (not 429) — not retried |
| `TIMEOUT`              | Request exceeded `timeoutMs` |
| `NETWORK_ERROR`        | fetch() threw (offline, CORS, etc.) |
| `MAX_RETRIES`          | All retry attempts failed |
| `NORMALISE_ERROR`      | Adapter received data it couldn't map |
| `VALIDATION_ERROR`     | api_service schema check failed |
| `ALL_PROVIDERS_FAILED` | Every provider in fallback chain failed |
| `PHASE_UNAVAILABLE`    | Neither phase endpoint responded |
