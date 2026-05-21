# Historical Market Engine

This module adds the realtime + historical ingestion layer for `SCAnalyticsPlatform`.

## What it does

- Normalizes provider payloads into canonical market points
- Normalizes timestamps to UTC minute buckets
- Deduplicates records using a deterministic `dedupe_hash`
- Bulk inserts price + quantity history into `market_prices`
- Recomputes rolling metrics per product using the last 7 days of data
- Stores anomaly-prep features in `volatility_metrics`
- Emits event candidates to `historical_market_events`
- Optionally raises `alerts` for high-confidence anomalies
- Caches the latest snapshot + batch metadata in Redis
- Cleans up aged rows with a scheduled worker

## Endpoints

### POST `/historical-market/ingest`
```json
{
  "realm": 0,
  "source": "extension",
  "payloads": [
    {
      "product_id": 6,
      "observed_at": "2026-05-21T16:30:00Z",
      "lowest_ask": 119.2,
      "highest_ask": 122.8,
      "vwap": 121.1,
      "total_supply": 821,
      "offer_count": 27,
      "demand_score": 0.64,
      "price_volatility": 0.07,
      "momentum_24h": 0.11
    }
  ]
}
```

### POST `/historical-market/cleanup`
```json
{
  "price_retention_days": 90,
  "metric_retention_days": 30,
  "event_retention_days": 180
}
```

## Worker usage

```python
from app.workers.historical_market_worker import run_historical_ingestion_job

await run_historical_ingestion_job(
    realm=0,
    source="simcotools",
    payloads=[...],
)
```
