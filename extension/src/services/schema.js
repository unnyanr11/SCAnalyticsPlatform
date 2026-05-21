/**
 * schema.js — Unified Internal Response Schema
 *
 * All providers normalise their raw API responses into these structures.
 * Consumers (overlays, AI engine, heatmap) only ever see these shapes.
 *
 * @module services/schema
 */

'use strict';

// ---------------------------------------------------------------------------
// Result wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps any service response so callers always get a consistent envelope.
 *
 * @template T
 * @param {T}      data      - Normalised payload
 * @param {string} provider  - Which adapter produced this ("simco" | "simcotools" | "cache")
 * @param {object} [meta]    - Optional extra metadata (age, request url, …)
 * @returns {{ ok: true, data: T, provider: string, ts: number, meta: object }}
 */
export function ok(data, provider = 'unknown', meta = {}) {
  return { ok: true, data, provider, ts: Date.now(), meta };
}

/**
 * Wraps a failed service call.
 *
 * @param {string} message    - Human-readable error
 * @param {string} code       - Machine-readable error code (e.g. RATE_LIMITED)
 * @param {string} [provider]
 * @returns {{ ok: false, error: string, code: string, provider: string, ts: number }}
 */
export function err(message, code = 'UNKNOWN_ERROR', provider = 'unknown') {
  return { ok: false, error: message, code, provider, ts: Date.now() };
}

// ---------------------------------------------------------------------------
// Data shapes — documented via JSDoc so the overlay layer has intellisense
// ---------------------------------------------------------------------------

/**
 * @typedef {object} MarketOffer
 * @property {number}  productId
 * @property {number}  realm         - 0 = Alpha, 1 = Beta
 * @property {number}  price
 * @property {number}  quantity
 * @property {number}  quality       - 0–3
 * @property {string}  sellerId
 * @property {string}  listedAt      - ISO-8601
 */

/**
 * @typedef {object} MarketSnapshot
 * @property {number}   productId
 * @property {number}   realm
 * @property {number}   lowestAsk
 * @property {number}   highestAsk
 * @property {number}   vwap          - volume-weighted average price
 * @property {number}   totalSupply
 * @property {number}   offerCount
 * @property {MarketOffer[]} offers
 * @property {string}   fetchedAt     - ISO-8601
 */

/**
 * @typedef {object} ResourceInfo
 * @property {number}  id
 * @property {number}  realm
 * @property {string}  key           - machine key, e.g. "steel"
 * @property {string}  name
 * @property {string}  category
 * @property {number}  retailPrice
 * @property {number}  transportCost
 * @property {number}  unitsPerRun
 * @property {number}  productionTime  - seconds
 * @property {boolean} isRawMaterial
 * @property {Array<{resourceId:number,quantity:number}>} inputs
 */

/**
 * @typedef {object} EconomyPhase
 * @property {number}  realm
 * @property {number}  phaseCode     - 0 stable | 1 boom | 2 recession | 3 recovery
 * @property {string}  phaseName
 * @property {number}  multiplier    - effect on retail/market prices
 * @property {string}  fetchedAt
 */

/**
 * @typedef {object} RetailInfo
 * @property {number}  productId
 * @property {number}  realm
 * @property {number}  retailPrice
 * @property {number}  maxRetailPrice
 * @property {number}  demand        - 0–1 normalised
 * @property {string}  fetchedAt
 */

/**
 * @typedef {object} SimcoToolsResource
 * @property {number}  id
 * @property {string}  key
 * @property {string}  name
 * @property {string}  category
 * @property {number|null} avgPrice24h
 * @property {number|null} avgPrice7d
 * @property {number|null} avgVolume24h
 * @property {number}  volatility
 * @property {string}  fetchedAt
 */

export const SCHEMA_VERSION = '1.0.0';
