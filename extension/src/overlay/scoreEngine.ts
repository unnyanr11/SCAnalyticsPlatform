/**
 * scoreEngine.ts
 *
 * Pure, deterministic scoring functions that convert raw intercepted
 * market data into the OverlayMetrics shape.
 *
 * No side effects. No DOM access. Safe to run in both content script
 * and background worker contexts.
 */

import type { MarketDirection, OverlayMetrics } from './types';

export interface RawMarketPayload {
  productId?: number;
  resourceId?: number;
  itemId?: number;
  id?: number;
  name?: string;
  vwap?: number;
  price?: number;
  lowestAsk?: number;
  highestAsk?: number;
  totalSupply?: number;
  quantity?: number;
  demandScore?: number;
  demand?: number;
  priceVolatility?: number;
  volatility?: number;
  momentum24h?: number;
  price24hAgo?: number;
  shortageRisk?: number;
  aiConfidence?: number;
  confidence?: number;
}

// ── Direction from momentum ───────────────────────────────────────────────
export function momentumToDirection(m: number): MarketDirection {
  if (m >= 0.12)  return 'strong_up';
  if (m >= 0.03)  return 'up';
  if (m <= -0.12) return 'strong_down';
  if (m <= -0.03) return 'down';
  return 'flat';
}

// ── Profitability score (0-100) ─────────────────────────────────────────
export function calcProfitabilityScore(raw: RawMarketPayload): number {
  const demand    = coerceFloat(raw.demandScore ?? raw.demand, 0.5);
  const momentum  = coerceFloat(raw.momentum24h, 0);
  const shortage  = coerceFloat(raw.shortageRisk, 0);
  const volatility= coerceFloat(raw.priceVolatility ?? raw.volatility, 0.2);

  // High demand + positive momentum + shortage risk → high profitability
  // High volatility is a risk discount
  const raw_score =
    demand      * 35 +
    Math.max(0, momentum) * 200 +  // momentum range ~0-0.3 -> 0-60 contribution
    shortage    * 20 -
    volatility  * 15;

  return Math.round(Math.min(100, Math.max(0, raw_score)));
}

// ── Shortage risk estimation ──────────────────────────────────────────────
export function estimateShortageRisk(raw: RawMarketPayload): number {
  if (typeof raw.shortageRisk === 'number') return clamp01(raw.shortageRisk);

  const supply   = coerceFloat(raw.totalSupply ?? raw.quantity, 50000);
  const demand   = coerceFloat(raw.demandScore ?? raw.demand, 0.5);
  const momentum = coerceFloat(raw.momentum24h, 0);

  // Low supply + high demand + upward momentum → shortage risk
  const supplyFactor = supply < 1000  ? 0.9
                     : supply < 5000  ? 0.7
                     : supply < 20000 ? 0.4
                     : supply < 80000 ? 0.2
                     : 0.05;

  return clamp01(
    supplyFactor * 0.5 +
    demand * 0.3 +
    Math.max(0, momentum) * 0.2,
  );
}

// ── Full metrics from raw payload ──────────────────────────────────────────
export function buildOverlayMetrics(
  raw: RawMarketPayload,
  productName?: string,
): OverlayMetrics {
  const productId = Number(
    raw.productId ?? raw.resourceId ?? raw.itemId ?? raw.id ?? 0,
  );

  const vwap = coerceFloat(
    raw.vwap ?? raw.price ?? raw.lowestAsk, 0,
  );

  const momentum = coerceFloat(raw.momentum24h, (() => {
    // Estimate momentum from price24hAgo if available
    if (raw.price24hAgo && vwap && raw.price24hAgo > 0) {
      return (vwap - raw.price24hAgo) / raw.price24hAgo;
    }
    return 0;
  })());

  const volatility = clamp01(
    coerceFloat(raw.priceVolatility ?? raw.volatility, 0.1),
  );

  const shortageRisk = estimateShortageRisk(raw);
  const aiConfidence = clamp01(
    coerceFloat(raw.aiConfidence ?? raw.confidence, 0.5),
  );

  return {
    productId,
    productName: productName ?? String(raw.name ?? `Product #${productId}`),
    profitabilityScore: calcProfitabilityScore({ ...raw, momentum24h: momentum, shortageRisk }),
    aiConfidence,
    volatility,
    shortageRisk,
    direction: momentumToDirection(momentum),
    momentum24h: momentum,
    currentPrice: vwap,
    updatedAt: Date.now(),
  };
}

// ── Utils ────────────────────────────────────────────────────────────────
function coerceFloat(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
