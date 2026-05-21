# API Services Layer

```
app/services/
├── __init__.py
├── http_client.py          # Shared async HTTP client (retry + rate-limit)
├── cache.py                # Redis / in-memory cache
├── schemas.py              # Unified internal Pydantic models
├── validators.py           # Raw API response validation
├── normalizers.py          # Raw dict → unified schema mapping
├── simcompanies_adapter.py # SimCompanies API adapter
├── simcotools_adapter.py   # SimcoTools API adapter
└── provider_registry.py   # Fallback orchestrator (public facade)
```

## Usage

```python
from app.services.provider_registry import registry

# Market snapshot (SimCompanies)
snap = await registry.get_market_snapshot(product_id=5, realm=0)
print(snap.vwap, snap.offer_count, snap.price_volatility)

# Economy phase (SimcoTools primary → SimCompanies fallback)
phase = await registry.get_economy_phase(realm=0)
print(phase.phase_name, phase.multiplier)

# All resources (both providers concurrently)
sc_entries, sct_entries = await registry.get_all_resources(realm=0)

# Price history for AI forecasting
history = await registry.get_price_history(product_id=6, realm=0)

# Provider health
statuses = registry.provider_statuses()
```

## API Endpoints Covered

| Provider | Endpoint | Method | Cached TTL |
|---|---|---|---|
| SimCompanies | `/api/v2/market/{item_id}` | GET | 30s |
| SimCompanies | `/api/v4/pt/{realm}/encyclopedia/resources/` | GET | 3600s |
| SimCompanies | `/api/v4/pt/{realm}/encyclopedia/resources/{id}/` | GET | 3600s |
| SimCompanies | `/api/v4/{realm}/resources-retail-info/` | GET | 300s |
| SimCompanies | `/api/v4/{realm}/economy-phase/` | GET | 60s |
| SimcoTools | `https://simcotools.app/api/v3/resources` | GET | 120s |
| SimcoTools | `https://simcotools.app/api/v3/resources/{id}` | GET | 120s |
| SimcoTools | `https://simcotools.app/api/v3/resources/{id}/history` | GET | 600s |
| SimcoTools | `https://api.simcotools.com/v1/realms/{realm}/phases` | GET | 60s |

## Rate Limiting

Per-host token buckets in `http_client.py`:

| Host | Rate | Burst |
|---|---|---|
| `www.simcompanies.com` | 2 req/s | 5 |
| `simcotools.app` | 3 req/s | 10 |
| `api.simcotools.com` | 3 req/s | 10 |

## Fallback Strategy

```
get_economy_phase:
  1. SimcoTools /v1/realms/{realm}/phases       ← primary
  2. SimCompanies /api/v4/{realm}/economy-phase/ ← fallback
  3. Last cached value (if available)

get_market_snapshot:
  1. SimCompanies /api/v2/market/{id}  ← only live market source
  (no fallback — live offer data is unique to SimCompanies)

get_all_resources:
  1. SimCompanies encyclopedia   \  both fetched
  2. SimcoTools enriched data    /  concurrently
```

## Adding a New Provider

1. Create `my_provider_adapter.py` implementing the same method signatures
2. Register it in `provider_registry.py` as a tertiary fallback
3. Add its host to `_BUCKETS` in `http_client.py`
4. Add its response format to `validators.py` + `normalizers.py`
