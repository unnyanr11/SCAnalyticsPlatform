/**
 * SC Analytics Platform — Shared Domain Types
 *
 * Single source of truth for all market domain types used across
 * the interception pipeline, cache, event bus, AI engine, and overlays.
 *
 * ⚠️ Analytics only — no mutable gameplay state is represented here.
 */

// ---------------------------------------------------------------------------
// Realms
// ---------------------------------------------------------------------------

/** 0 = Sigma (main), 1 = Alpha (prestige) */
export type Realm = 0 | 1;

// ---------------------------------------------------------------------------
// Market Offers
// ---------------------------------------------------------------------------

export interface MarketOffer {
  /** Sim Companies internal resource/item ID */
  resourceId:  number;
  /** Seller company ID */
  companyId:   number;
  /** Offer price per unit */
  price:       number;
  /** Available quantity */
  quantity:    number;
  /** Quality tier: 0–3 (0 = no quality system for this resource) */
  quality:     number;
  /** Unix timestamp (ms) when this offer was observed */
  observedAt:  number;
  realm:       Realm;
}

// ---------------------------------------------------------------------------
// Market Snapshot
// ---------------------------------------------------------------------------

/**
 * Aggregated market state for a single resource at a point in time.
 * Computed by ResponseParser from raw MarketOffer arrays.
 */
export interface MarketSnapshot {
  resourceId:      number;
  realm:           Realm;
  /** Unix timestamp (ms) of snapshot */
  timestamp:       number;
  /** Lowest ask price across all offers */
  lowestAsk:       number;
  /** Highest ask price across all offers */
  highestAsk:      number;
  /** Volume-weighted average price */
  vwap:            number;
  /** Total units available across all offers */
  totalSupply:     number;
  /** Number of distinct offers */
  offerCount:      number;
  /** Simple demand proxy: reciprocal of median offer age (higher = faster turnover) */
  demandScore:     number;
  /** Standard deviation of offer prices (0 = all same price) */
  priceVolatility: number;
}

// ---------------------------------------------------------------------------
// Resource / Encyclopedia Info
// ---------------------------------------------------------------------------

export interface ResourceInfo {
  id:             number;
  /** Internal slug, e.g. "processors" */
  key:            string;
  /** Display name */
  name:           string;
  /** Category: agriculture | electronics | automotive | aerospace | chemicals | retail | research */
  category:       string;
  /** Base retail price (from game data) */
  retailPrice:    number;
  /** Units produced per production run */
  unitsPerRun:    number;
  /** Production time in seconds */
  productionTime: number;
  /** Ingredients required per production run */
  ingredients:    ResourceIngredient[];
  /** Quality tiers available (empty = no quality system) */
  qualityTiers:   number[];
  realm:          Realm;
  /** Unix timestamp (ms) when this info was last refreshed */
  updatedAt:      number;
}

export interface ResourceIngredient {
  resourceId: number;
  quantity:   number;
}

// ---------------------------------------------------------------------------
// Economy Phase
// ---------------------------------------------------------------------------

export type EconomyPhaseName =
  | 'boom'
  | 'stable'
  | 'recession'
  | 'recovery'
  | 'unknown';

export interface EconomyPhase {
  realm:      Realm;
  name:       EconomyPhaseName;
  /** 1–4 numeric phase code as returned by SimcoTools */
  code:       number;
  /** Multiplier applied to retail prices during this phase (e.g. 1.2 = 20% boost) */
  multiplier: number;
  /** Unix timestamp (ms) when this phase was last observed */
  observedAt: number;
  /** Estimated phase end time if provided by source */
  endsAt?:    number;
}

// ---------------------------------------------------------------------------
// AI Prediction (used by AI engine + overlay)
// ---------------------------------------------------------------------------

export type SignalLabel =
  | 'strong_buy'
  | 'buy'
  | 'hold'
  | 'sell'
  | 'strong_sell'
  | 'shortage_incoming'
  | 'oversaturated';

export interface AIPrediction {
  resourceId:       number;
  realm:            Realm;
  signal:           SignalLabel;
  confidenceScore:  number;   // 0.0 – 1.0
  predictedMargin:  number;   // expected profit % over production cost
  shortageRisk:     number;   // 0.0 – 1.0
  oversatRisk:      number;   // 0.0 – 1.0
  priceTargetLow:   number;
  priceTargetHigh:  number;
  reasoning:        string;   // human-readable explanation
  generatedAt:      number;
  modelVersion:     string;
}

// ---------------------------------------------------------------------------
// Alert
// ---------------------------------------------------------------------------

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface MarketAlert {
  id:           string;
  resourceId:   number;
  realm:        Realm;
  severity:     AlertSeverity;
  message:      string;
  triggeredAt:  number;
  acknowledged: boolean;
}
