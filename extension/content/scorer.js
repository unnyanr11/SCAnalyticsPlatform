/**
 * scorer.js
 * SC Analytics Platform — Feature 1: Live Market Intelligence Overlay
 *
 * Deterministic scoring engine. Scores each normalized MarketItem
 * for display in overlay badges. Uses historical snapshots stored
 * in memory for trend and volatility calculations.
 *
 * Scores are pure analytics — no automated actions are ever taken.
 */

(function () {
  'use strict';

  // ─── In-memory price history store ───────────────────────────────────────────────
  // Stores last MAX_HISTORY snapshots per item id
  const MAX_HISTORY = 20;
  const HISTORY_MAP = new Map(); // id → [{price, quantity, ts}]

  function recordSnapshot(item) {
    if (!item.id || !item.price) return;
    if (!HISTORY_MAP.has(item.id)) HISTORY_MAP.set(item.id, []);
    const arr = HISTORY_MAP.get(item.id);
    arr.push({ price: item.price, quantity: item.quantity, ts: item.timestamp });
    if (arr.length > MAX_HISTORY) arr.shift();
  }

  // ─── Statistical helpers ──────────────────────────────────────────────────────

  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  function stddev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
  }

  /** Linear regression slope over a price series */
  function priceTrendSlope(snapshots) {
    if (snapshots.length < 3) return 0;
    const n = snapshots.length;
    const xs = snapshots.map((_, i) => i);
    const ys = snapshots.map((s) => s.price);
    const xMean = mean(xs);
    const yMean = mean(ys);
    const num = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
    const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
    return den === 0 ? 0 : num / den;
  }

  /** Inventory depletion rate: negative = shrinking fast */
  function inventoryTrend(snapshots) {
    if (snapshots.length < 3) return 0;
    const qtys = snapshots.map((s) => s.quantity);
    return priceTrendSlope(
      snapshots.map((s, i) => ({ price: qtys[i] }))
    );
  }

  // ─── Score calculators ─────────────────────────────────────────────────────────

  /**
   * Profitability score (0–100).
   * Uses margin over retail or production cost.
   */
  function calcProfitabilityScore(item) {
    const ref = item.retailPrice || item.productionCost || 0;
    if (!ref || !item.price) return 50; // neutral when unknown
    const margin = (item.price - ref) / ref;
    // clamp −1 → +2 range to 0–100
    const clamped = Math.max(-1, Math.min(2, margin));
    return Math.round(((clamped + 1) / 3) * 100);
  }

  /**
   * Volatility score (0–100).
   * Coefficient of variation on recent price history.
   */
  function calcVolatilityScore(history) {
    if (history.length < 3) return 50;
    const prices = history.map((h) => h.price).filter(Boolean);
    const m = mean(prices);
    if (!m) return 50;
    const cv = stddev(prices) / m;
    return Math.round(Math.min(100, cv * 500)); // 20% CV → 100
  }

  /**
   * Price direction: 'up' | 'down' | 'stable'
   * Based on linear regression slope on recent snapshots.
   */
  function calcPriceDirection(history) {
    const slope = priceTrendSlope(history);
    const prices = history.map((h) => h.price);
    const m = mean(prices);
    if (!m) return 'stable';
    const relSlope = slope / m;
    if (relSlope > 0.015) return 'up';
    if (relSlope < -0.015) return 'down';
    return 'stable';
  }

  /**
   * Demand trend: 'rising' | 'falling' | 'stable'
   * Based on inventory depletion rate.
   */
  function calcDemandTrend(history) {
    const rate = inventoryTrend(history);
    const qtys = history.map((h) => h.quantity);
    const m = mean(qtys);
    if (!m) return 'stable';
    const relRate = rate / m;
    if (relRate < -0.02) return 'rising'; // inventory falling → demand rising
    if (relRate > 0.02) return 'falling';
    return 'stable';
  }

  /**
   * Shortage probability (0–100).
   * Combines low quantity trend + high price spike + fast depletion.
   */
  function calcShortageProbability(item, history) {
    let score = 0;
    if (history.length >= 3) {
      const qTrend = inventoryTrend(history);
      const qMean = mean(history.map((h) => h.quantity));
      if (qMean && qTrend / qMean < -0.03) score += 40;
      const pDir = calcPriceDirection(history);
      if (pDir === 'up') score += 30;
    }
    if (item.quantity < 10) score += 30;
    else if (item.quantity < 50) score += 10;
    return Math.min(100, score);
  }

  /**
   * Oversaturation risk (0–100).
   * High quantity + falling price = oversaturated.
   */
  function calcOversaturationRisk(item, history) {
    let score = 0;
    if (history.length >= 3) {
      const pDir = calcPriceDirection(history);
      if (pDir === 'down') score += 40;
    }
    if (item.quantity > 500) score += 30;
    else if (item.quantity > 200) score += 15;
    const ref = item.retailPrice || item.productionCost || 0;
    if (ref && item.price < ref * 0.9) score += 30;
    return Math.min(100, score);
  }

  /**
   * AI Confidence score (0–100).
   * Higher when more historical data is available.
   */
  function calcConfidence(history) {
    return Math.min(100, Math.round((history.length / MAX_HISTORY) * 100));
  }

  // ─── Badge label resolution ────────────────────────────────────────────────────

  function resolveLabel(scores) {
    const { profitability, priceDirection, shortage, oversaturation, volatility } = scores;

    if (shortage >= 65) return { icon: '⚠', text: 'Shortage Incoming', type: 'warning' };
    if (oversaturation >= 65) return { icon: '↓', text: 'Oversaturated', type: 'danger' };
    if (profitability >= 75 && priceDirection === 'up') return { icon: '🔥', text: 'Strong Buy', type: 'bullish' };
    if (profitability >= 60) return { icon: '📈', text: 'High Profit', type: 'bullish' };
    if (priceDirection === 'up') return { icon: '↑', text: 'Bullish Trend', type: 'bullish' };
    if (priceDirection === 'down') return { icon: '📉', text: 'Bearish Trend', type: 'bearish' };
    if (volatility >= 70) return { icon: '⚡', text: 'High Volatility', type: 'volatile' };
    return { icon: '―', text: 'Stable', type: 'neutral' };
  }

  // ─── Main score function ──────────────────────────────────────────────────────────

  /**
   * Scores a normalized MarketItem and returns a ScoredItem.
   * @param {import('./normalizer').MarketItem} item
   * @returns {ScoredItem}
   */
  function score(item) {
    recordSnapshot(item);
    const history = HISTORY_MAP.get(item.id) || [];

    const profitability = calcProfitabilityScore(item);
    const volatility = calcVolatilityScore(history);
    const priceDirection = calcPriceDirection(history);
    const demandTrend = calcDemandTrend(history);
    const shortage = calcShortageProbability(item, history);
    const oversaturation = calcOversaturationRisk(item, history);
    const confidence = calcConfidence(history);

    const scores = { profitability, volatility, priceDirection, demandTrend, shortage, oversaturation, confidence };
    const label = resolveLabel(scores);

    return { ...item, scores, label };
  }

  // ─── Listen to normalized items and re-dispatch scored items ─────────────────
  window.addEventListener('SCA_NORMALIZED_ITEMS', (event) => {
    const { items, source, timestamp } = event.detail;
    const scoredItems = items.map(score);
    window.dispatchEvent(
      new CustomEvent('SCA_SCORED_ITEMS', {
        detail: { items: scoredItems, source, timestamp },
      })
    );
  });

  window.SCAScorer = { score };
  console.debug('[SCA] Scorer active.');
})();
