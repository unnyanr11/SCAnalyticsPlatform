import type { MarketDirection, OverlaySignal } from './overlayTypes';

export function scoreColor(score: number): string {
  if (score >= 70) return '#34d399'; // emerald
  if (score >= 45) return '#fbbf24'; // amber
  return '#f87171';                  // red
}

export function riskColor(risk: number): string {
  if (risk >= 0.7) return '#f97316'; // orange
  if (risk >= 0.4) return '#fbbf24'; // amber
  return '#64748b';                  // slate
}

export function directionLabel(d: MarketDirection): string {
  const MAP: Record<MarketDirection, string> = {
    strong_up:   '↑↑ Strong Up',
    up:          '↑ Rising',
    neutral:     '— Neutral',
    down:        '↓ Falling',
    strong_down: '↓↓ Strong Down',
  };
  return MAP[d];
}

export function directionColor(d: MarketDirection): string {
  if (d === 'strong_up' || d === 'up')       return '#34d399';
  if (d === 'strong_down' || d === 'down')   return '#f87171';
  return '#94a3b8';
}

export function signalLabel(s: OverlaySignal): string {
  const MAP: Record<OverlaySignal, string> = {
    strong_buy:  '↑ Strong Buy',
    buy:         '↑ Buy',
    hold:        '— Hold',
    sell:        '↓ Sell',
    strong_sell: '↓↓ Strong Sell',
  };
  return MAP[s];
}

export function signalColor(s: OverlaySignal): string {
  if (s === 'strong_buy')  return '#34d399';
  if (s === 'buy')         return '#4ade80';
  if (s === 'sell')        return '#fb923c';
  if (s === 'strong_sell') return '#f87171';
  return '#94a3b8';
}

/** Derive overlay metrics from raw market data payload. */
export function deriveMetrics(
  productId: number,
  productName: string,
  payload: Record<string, unknown>,
): import('./overlayTypes').OverlayMetrics {
  const vwap       = num(payload, 'vwap', 'price') || 1;
  const lowestAsk  = num(payload, 'lowest_ask', 'bid') || vwap;
  const supply     = num(payload, 'total_supply', 'quantity') || 0;
  const demand     = num(payload, 'demand_score', 'demand') || 0;
  const vol        = num(payload, 'price_volatility', 'volatility') || 0;
  const mom24h     = num(payload, 'momentum_24h') || 0;
  const shortage   = num(payload, 'shortage_risk') || Math.max(0, 1 - supply / 10000);
  const oversat    = num(payload, 'oversat_risk')  || Math.max(0, supply / 200000);
  const margin     = num(payload, 'expected_margin_pct') || (mom24h * 100);
  const confidence = num(payload, 'ai_confidence') || Math.min(0.95, demand * 0.9 + 0.05);

  const profitabilityScore = Math.round(
    Math.min(100, Math.max(0,
      demand * 50 + Math.max(0, mom24h) * 30 + Math.max(0, 1 - vol) * 20,
    )),
  );

  const direction: MarketDirection =
    mom24h >= 0.10 ? 'strong_up' :
    mom24h >= 0.03 ? 'up' :
    mom24h <= -0.10 ? 'strong_down' :
    mom24h <= -0.03 ? 'down' :
    'neutral';

  const signal: OverlaySignal =
    profitabilityScore >= 80 && shortage >= 0.6 ? 'strong_buy' :
    profitabilityScore >= 60 ? 'buy' :
    profitabilityScore <= 25 || oversat >= 0.7  ? 'strong_sell' :
    profitabilityScore <= 40 ? 'sell' :
    'hold';

  return {
    productId,
    productName,
    profitabilityScore,
    aiConfidence: parseFloat(confidence.toFixed(3)),
    volatility: parseFloat(vol.toFixed(3)),
    shortageRisk: parseFloat(shortage.toFixed(3)),
    oversatRisk: parseFloat(oversat.toFixed(3)),
    marketDirection: direction,
    signal,
    expectedMarginPct: parseFloat(margin.toFixed(2)),
    updatedAt: Date.now(),
  };
}

function num(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string') { const n = parseFloat(v); if (isFinite(n)) return n; }
  }
  return 0;
}
