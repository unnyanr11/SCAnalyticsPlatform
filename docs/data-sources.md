# Data Sources — SC Analytics Platform

All data collection in SC Analytics Platform is **read-only** and relies on
publicly accessible APIs. No user credentials are used for data fetching.

---

## Primary Sources

### 1. SimcoTools App API

| Endpoint | Description | TTL |
|---|---|---|
| `https://simcotools.app/api/v3/resources` | All resources with aggregated market analytics | 5 min |
| `https://simcotools.app/api/v3/resources/{id}` | Single resource detail | 2 min |
| `https://simcotools.app/api/v3/resources/{id}/history` | Historical price data | 10 min |

### 2. SimcoTools Alt API

| Endpoint | Description | TTL |
|---|---|---|
| `https://api.simcotools.com/v1/realms/{realm}/phases` | Economy phase | 1 min |

---

## Secondary Sources (Fallback)

### 3. SimCompanies Public API

| Endpoint | Description | TTL |
|---|---|---|
| `/api/v2/market/{itemId}` | Single item market listing | 30 s |
| `/api/v4/pt/{realm}/encyclopedia/resources` | Full resource catalogue | 5 min |
| `/api/v4/{realm}/resources-retail-info/` | NPC / retail prices | 2 min |

---

## Fallback Strategy

The `api_provider.py` service implements a two-tier provider fallback:

```
Request → Try SimcoTools
           ├ Success → return normalized data
           └ Failure → Try SimCompanies direct
                        ├ Success → return normalized data
                        └ Failure → return None, log warning
```

This ensures resilience against:
- API endpoint changes
- Temporary downtime
- Schema updates
- Rate limiting on a single provider

---

## Rate Limiting

| Provider | Limit | Implementation |
|---|---|---|
| SimCompanies | 20 req/min | Token bucket (`_RateLimiter`) |
| SimcoTools | 30 req/min | Token bucket (`_RateLimiter`) |
| Local backend | 120 req/min | No constraint |

Polling intervals are configured in `shared/constants/endpoints.ts`.

---

## Caching

All responses are cached in Redis with TTL values matching the data volatility:

| Data type | Redis TTL |
|---|---|
| Market item price | 30 s |
| Resource catalogue | 5 min |
| Retail info | 2 min |
| Economy phase | 1 min |
| AI predictions | 2 min |

---

## Data Normalizer

Since API schemas differ between providers, all responses pass through
`data_normalizer.py` before storage or analysis:

- Field name aliases handled (e.g., `marketPrice` vs `price` vs `avg_price`)
- Missing fields default gracefully
- Invalid records are skipped with a warning log
- Phase name aliases mapped to canonical values

---

## Schema Compatibility

The system is designed to handle schema changes without downtime:

- All field lookups use ordered alias lists (`_PRICE_KEYS`, `_QTY_KEYS`, etc.)
- New field names can be added to the alias lists without breaking existing logic
- Pydantic schemas use `Optional` fields for non-critical data
- Unexpected fields are ignored (not errors)

---

## Extension Interception

In addition to backend polling, the extension content script intercepts
API responses already loaded by the SimCompanies game page:

- `fetch()` responses are read via a proxy wrapper
- XHR responses are observed via `readystatechange`
- Intercepted payloads are forwarded to the background service worker
- **No additional requests are made** using the user’s authenticated session
