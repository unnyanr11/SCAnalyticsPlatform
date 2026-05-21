/**
 * Typed HTTP client for the /api/v1/predict backend.
 * Used by the React hook and the overlay system.
 */

const API_BASE =
  (typeof chrome !== 'undefined' && chrome.runtime?.id)
    ? 'http://localhost:8000'
    : 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Types (mirror backend Pydantic schemas)
// ---------------------------------------------------------------------------

export type EconomyPhase = 'boom' | 'stable' | 'recession' | 'recovery';
export type Recommendation = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
export type TrendDirection = 'strong_up' | 'up' | 'neutral' | 'down' | 'strong_down';

export interface PricePoint {
  timestamp:  number;
  price:      number;
  quantity?:  number;
  supply?:    number;
  demand?:    number;
}

export interface PredictionRequest {
  product_id:       number;
  product_name?:    string;
  realm?:           number;
  history:          PricePoint[];
  economy_phase?:   EconomyPhase;
  production_cost?: number;
  horizon_hours?:   number;
}

export interface ForecastPoint {
  timestamp:   number;
  price:       number;
  lower_bound: number;
  upper_bound: number;
}

export interface ReasoningStep {
  factor:      string;
  impact:      'positive' | 'negative' | 'neutral';
  description: string;
  weight:      number;
}

export interface PredictionResult {
  product_id:            number;
  product_name:          string;
  realm:                 number;
  predicted_margin_pct:  number;
  expected_roi_pct:      number;
  risk_score:            number;
  confidence:            number;
  recommendation:        Recommendation;
  trend_direction:       TrendDirection;
  price_forecast:        ForecastPoint[];
  prophet_trend_pct:     number;
  xgb_predicted_price:   number;
  volatility_score:      number;
  shortage_risk:         number;
  oversat_risk:          number;
  reasoning_summary:     string;
  reasoning_steps:       ReasoningStep[];
  model_versions:        Record<string, string>;
  generated_at:          number;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

async function postPredict(req: PredictionRequest): Promise<PredictionResult> {
  const res = await fetch(`${API_BASE}/api/v1/predict`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(req),
    signal:  AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[PredictorClient] ${res.status}: ${text}`);
  }
  return res.json() as Promise<PredictionResult>;
}

async function getLatest(productId: number): Promise<PredictionResult | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/predict/${productId}/latest`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json() as Promise<PredictionResult>;
  } catch {
    return null;
  }
}

export const predictorClient = { postPredict, getLatest };
