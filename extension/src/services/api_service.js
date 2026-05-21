/**
 * api_service.js — Unified public-facing API for the SCAnalyticsPlatform extension
 *
 * This is the ONLY module that overlay/dashboard/AI components should import.
 * It wraps the provider registry and adds:
 *  - Batch fetching helpers
 *  - Validation (schema integrity checks on returned data)
 *  - Concise debug logging (controllable via LOG_LEVEL)
 *  - Convenience accessors that overlay modules actually use
 *
 * Usage:
 *   import * as API from '../services/api_service.js';
 *   const market = await API.market(4);          // steel market
 *   const phase  = await API.economyPhase();     // current phase
 *   const info   = await API.resource(4);        // steel encyclopedia entry
 *
 * @module services/api_service
 */

'use strict';

import * as registry from './provider_registry.js';
import { cache }     from './cache.js';
import { ok, err }   from './schema.js';

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const LOG_LEVEL = (() => {
  try { return chrome?.storage?.local ? 'warn' : 'debug'; } catch { return 'debug'; }
})();

const log = {
  debug: (...a) => LOG_LEVEL === 'debug' && console.debug('[SCA:api]', ...a),
  warn:  (...a) => console.warn('[SCA:api]', ...a),
  error: (...a) => console.error('[SCA:api]', ...a),
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateMarket(data) {
  return data &&
    typeof data.productId === 'number' &&
    typeof data.vwap      === 'number' &&
    Array.isArray(data.offers);
}

function validateResource(data) {
  return data &&
    typeof data.id   === 'number' &&
    typeof data.name === 'string' &&
    Array.isArray(data.inputs);
}

function validatePhase(data) {
  return data &&
    typeof data.phaseCode  === 'number' &&
    typeof data.phaseName  === 'string' &&
    typeof data.multiplier === 'number';
}

function validateRetailInfo(arr) {
  return Array.isArray(arr);
}

/**
 * Wraps a registry call, validates the result, and returns a consistent shape.
 *
 * @template T
 * @param {() => Promise<any>} fn
 * @param {(data: T) => boolean} validator
 * @param {string} label   - for log messages
 * @returns {Promise<{ ok: boolean, data?: T, error?: string, provider?: string }>}
 */
async function validated(fn, validator, label) {
  let result;
  try {
    result = await fn();
  } catch (e) {
    log.error(`${label} threw:`, e);
    return err(`${label} threw: ${e?.message ?? e}`, 'THROWN');
  }

  if (!result?.ok) {
    log.warn(`${label} failed:`, result?.error);
    return result;
  }

  if (!validator(result.data)) {
    log.warn(`${label} validation failed — unexpected shape`, result.data);
    return err(`${label} returned invalid data shape`, 'VALIDATION_ERROR', result.provider);
  }

  log.debug(`${label} ok (${result.provider})`);
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the live market snapshot for a product.
 *
 * @param {number}  productId
 * @param {number}  [realm=0]
 * @returns {Promise<{ ok: boolean, data?: import('./schema.js').MarketSnapshot }>}
 */
export function market(productId, realm = 0) {
  return validated(
    () => registry.getMarket(productId, realm),
    validateMarket,
    `market(${productId}, ${realm})`,
  );
}

/**
 * Get a single encyclopedia resource.
 *
 * @param {number}  resourceId
 * @param {number}  [realm=0]
 * @returns {Promise<{ ok: boolean, data?: import('./schema.js').ResourceInfo }>}
 */
export function resource(resourceId, realm = 0) {
  return validated(
    () => registry.getResource(resourceId, realm),
    validateResource,
    `resource(${resourceId}, ${realm})`,
  );
}

/**
 * Get the full encyclopedia for a realm.
 *
 * @param {number} [realm=0]
 * @returns {Promise<{ ok: boolean, data?: import('./schema.js').ResourceInfo[] }>}
 */
export function encyclopedia(realm = 0) {
  return validated(
    () => registry.getEncyclopedia(realm),
    arr => Array.isArray(arr),
    `encyclopedia(${realm})`,
  );
}

/**
 * Get current economy phase.
 *
 * @param {number} [realm=0]
 * @returns {Promise<{ ok: boolean, data?: import('./schema.js').EconomyPhase }>}
 */
export function economyPhase(realm = 0) {
  return validated(
    () => registry.getEconomyPhase(realm),
    validatePhase,
    `economyPhase(${realm})`,
  );
}

/**
 * Get retail pricing info for all resources.
 *
 * @param {number} [realm=0]
 * @returns {Promise<{ ok: boolean, data?: import('./schema.js').RetailInfo[] }>}
 */
export function retailInfo(realm = 0) {
  return validated(
    () => registry.getRetailInfo(realm),
    validateRetailInfo,
    `retailInfo(${realm})`,
  );
}

/**
 * Get SimcoTools aggregated resource analytics.
 *
 * @returns {Promise<{ ok: boolean, data?: import('./schema.js').SimcoToolsResource[] }>}
 */
export function resources() {
  return validated(
    () => registry.getResources(),
    arr => Array.isArray(arr),
    'resources()',
  );
}

/**
 * Get price history for a resource.
 *
 * @param {number}  resourceId
 * @param {number}  [realm=0]
 * @returns {Promise<{ ok: boolean, data?: Array<{ts:string, price:number, volume:number}> }>}
 */
export function resourceHistory(resourceId, realm = 0) {
  return validated(
    () => registry.getResourceHistory(resourceId, realm),
    arr => Array.isArray(arr),
    `resourceHistory(${resourceId}, ${realm})`,
  );
}

// ---------------------------------------------------------------------------
// Batch helpers
// ---------------------------------------------------------------------------

/**
 * Fetch market snapshots for multiple products in parallel.
 *
 * @param {number[]} productIds
 * @param {number}   [realm=0]
 * @param {number}   [concurrency=5]  max simultaneous requests
 * @returns {Promise<Record<number, import('./schema.js').MarketSnapshot|null>>}
 */
export async function marketBatch(productIds, realm = 0, concurrency = 5) {
  const results = {};
  const ids = [...productIds];

  while (ids.length > 0) {
    const batch = ids.splice(0, concurrency);
    const settled = await Promise.allSettled(
      batch.map(id => market(id, realm).then(r => ({ id, r })))
    );
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        const { id, r } = s.value;
        results[id] = r.ok ? r.data : null;
      } else {
        log.warn('marketBatch item rejected:', s.reason);
      }
    }
  }

  return results;
}

/**
 * Fetch all key data needed for the market heatmap in one parallel call.
 *
 * Returns { phase, retailInfo, resources } — market per-product is fetched
 * lazily by the heatmap component itself.
 *
 * @param {number} [realm=0]
 */
export async function heatmapBootstrap(realm = 0) {
  const [phaseRes, retailRes, resourcesRes] = await Promise.allSettled([
    economyPhase(realm),
    retailInfo(realm),
    resources(),
  ]);

  return ok({
    phase:       phaseRes.status === 'fulfilled'     && phaseRes.value?.ok     ? phaseRes.value.data     : null,
    retailInfo:  retailRes.status === 'fulfilled'    && retailRes.value?.ok    ? retailRes.value.data    : [],
    resources:   resourcesRes.status === 'fulfilled' && resourcesRes.value?.ok ? resourcesRes.value.data : [],
  }, 'api_service');
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/**
 * Return cache stats + provider health for the diagnostics overlay.
 */
export function diagnostics() {
  return {
    cache:    cache.stats(),
    providers: registry.healthSnapshot(),
  };
}

/**
 * Clear the entire cache (e.g., user presses refresh in the popup).
 */
export function clearCache() {
  cache.clear();
  log.debug('cache cleared by user');
}
