# API Reference — SC Analytics Platform Backend

Base URL: `http://localhost:8000`

All endpoints are **read-only analytics APIs**. No endpoint modifies
game state or initiates actions on behalf of users.

---

## Health

### `GET /health`

Returns service health status.

**Response**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "environment": "development"
}
```

---

## Market Prices

### `GET /api/v1/market/prices`

Returns paginated list of recent market price records.

**Query params**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number |
| `page_size` | int | 50 | Results per page (max 200) |
| `realm` | int | 0 | Realm (0=Alpha, 1=Beta) |

**Response** — `PaginatedPrices`
```json
{
  "items": [...],
  "total": 1500,
  "page": 1,
  "page_size": 50
}
```

### `GET /api/v1/market/prices/{product_id}`

Returns recent price history for a single product.

### `GET /api/v1/market/heatmap`

Returns a scored heatmap of all products.

**Response** — `MarketHeatmap`

### `GET /api/v1/market/shortages`

Returns products with active shortage signals.

### `GET /api/v1/market/arbitrage`

Returns detected arbitrage opportunities.

---

## AI Predictions

### `GET /api/v1/ai/predictions`

Returns latest AI predictions for all tracked products.

### `GET /api/v1/ai/predictions/{product_id}`

Returns the latest prediction for a specific product.

**Response** — `AIPrediction`
```json
{
  "id": "uuid",
  "product_id": 10,
  "model_type": "xgboost",
  "predicted_price": 265.0,
  "predicted_margin_pct": 14.3,
  "confidence": 0.82,
  "direction": "up",
  "reasoning": "Processors expected to rise 14% due to declining inventory...",
  "shortage_prob": 0.34,
  "oversaturation_risk": 0.08,
  "horizon_hours": 24,
  "created_at": "2026-05-21T15:00:00Z"
}
```

---

## Economy

### `GET /api/v1/economy/phase`

Returns the current economy phase for the specified realm.

**Query params**
| Param | Type | Default |
|---|---|---|
| `realm` | int | 0 |

**Response** — `EconomyPhaseRecord`

### `GET /api/v1/economy/strategy`

Returns AI-generated investment strategy based on current economy phase.

**Response** — `EconomyStrategy`

---

## Production Optimizer

### `POST /api/v1/production/optimize`

Generates an optimized production plan based on player parameters.

**Request body** — `ProductionOptimizerInput`
```json
{
  "player_level": 20,
  "available_capital": 500000,
  "factory_count": 10,
  "worker_count": 200,
  "admin_level": 5,
  "economy_phase": "stable",
  "realm": 0
}
```

**Response** — list of `ProductionPlan`

---

## Alerts

### `GET /api/v1/alerts`

Returns all active alerts.

**Query params**
| Param | Type | Default |
|---|---|---|
| `unread_only` | bool | false |
| `realm` | int | 0 |

**Response** — `PaginatedAlerts`

### `PATCH /api/v1/alerts/{alert_id}/read`

Marks an alert as read.

---

## Portfolio

### `GET /api/v1/portfolio`

Returns portfolio summary with valuation and risk distribution.

**Response** — `PortfolioSummary`

---

## AI Assistant

### `POST /api/v1/assistant/query`

Submits a natural language query to the AI strategy assistant.

**Request body**
```json
{
  "query": "What should I produce now?",
  "realm": 0,
  "context": {
    "player_level": 20,
    "economy_phase": "stable"
  }
}
```

**Response** — `AssistantResponse`
```json
{
  "query": "What should I produce now?",
  "answer": "Based on current market data, Processors show strong margins...",
  "confidence_score": 0.87,
  "data_points": [...],
  "recommendation": "produce",
  "related_product_ids": [10, 12, 14],
  "generated_at": "2026-05-21T15:00:00Z"
}
```

---

## Settings

### `GET /api/v1/settings`

Returns current extension analytics settings.

### `PUT /api/v1/settings`

Updates analytics settings (polling intervals, realm, thresholds).

---

## Error Responses

All errors follow:
```json
{
  "detail": "Human-readable error message"
}
```

| Status | Meaning |
|---|---|
| `200` | Success |
| `404` | Resource not found |
| `422` | Validation error |
| `429` | Rate limited |
| `503` | External API unavailable |
