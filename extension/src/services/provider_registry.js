/**
 * provider_registry.js — Multi-provider registry with fallback chain
 *
 * Manages a prioritised list of providers for each data type.
 * When the primary provider fails, the registry automatically
 * tries the next provider in the chain.
 *
 * Provider priority (configurable):
 *   market:       simco → simcotools
 *   encyclopedia: simco
 *   phase:        simco → simcotools
 *   retail:       simco
 *   resources:    simcotools → simco (encyclopedia)
 *   history:      simcotools
 *
 * @module services/provider_registry
 */

'use strict';

import * as simco       from './simco_adapter.js';
import * as simcotools  from './simcotools_adapter.js';
import { err }          from './schema.js';

// ---------------------------------------------------------------------------
// Provider health tracking
// ---------------------------------------------------------------------------

const _health = new Map(); // providerId → { failures: number, disabledUntil: number }
const CIRCUIT_BREAKER_THRESHOLD = 5;      // consecutive failures
const CIRCUIT_BREAKER_COOLDOWN  = 60_000; // ms before retrying a broken provider

function _isHealthy(providerId) {
  const h = _health.get(providerId);
  if (!h) return true;
  if (h.disabledUntil && Date.now() < h.disabledUntil) return false;
  return true;
}

function _recordFailure(providerId) {
  const h = _health.get(providerId) ?? { failures: 0, disabledUntil: 0 };
  h.failures++;
  if (h.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    h.disabledUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN;
    console.warn(`[provider_registry] Circuit breaker tripped for ${providerId} — pausing ${CIRCUIT_BREAKER_COOLDOWN / 1000}s`);
  }
  _health.set(providerId, h);
}

function _recordSuccess(providerId) {
  _health.set(providerId, { failures: 0, disabledUntil: 0 });
}

// ---------------------------------------------------------------------------
// Generic fallback executor
// ---------------------------------------------------------------------------

/**
 * Try each provider in `chain` until one succeeds.
 *
 * @param {Array<{ id: string, fn: () => Promise<any> }>} chain
 * @returns {Promise<any>}  Unified schema result
 */
async function _withFallback(chain) {
  const errors = [];

  for (const { id, fn } of chain) {
    if (!_isHealthy(id)) {
      errors.push(`${id}: circuit open`);
      continue;
    }

    const result = await fn().catch(e => err(e?.message ?? String(e), 'THROWN', id));

    if (result?.ok) {
      _recordSuccess(id);
      return result;
    }

    _recordFailure(id);
    errors.push(`${id}: ${result?.error ?? 'unknown error'}`);
  }

  return err(
    `All providers failed: ${errors.join(' | ')}`,
    'ALL_PROVIDERS_FAILED',
    'registry',
  );
}

// ---------------------------------------------------------------------------
// Public registry methods
// ---------------------------------------------------------------------------

/**
 * Get live market data with simco → simcotools fallback.
 * @param {number} productId
 * @param {number} [realm=0]
 */
export function getMarket(productId, realm = 0) {
  return _withFallback([
    { id: 'simco',      fn: () => simco.getMarket(productId, realm) },
    { id: 'simcotools', fn: () => simcotools.getMarket(productId, realm) },
  ]);
}

/**
 * Get encyclopedia resource info (simco only — no simcotools mirror).
 * @param {number} resourceId
 * @param {number} [realm=0]
 */
export function getResource(resourceId, realm = 0) {
  return _withFallback([
    { id: 'simco', fn: () => simco.getResource(resourceId, realm) },
  ]);
}

/**
 * Get full encyclopedia.
 * @param {number} [realm=0]
 */
export function getEncyclopedia(realm = 0) {
  return _withFallback([
    { id: 'simco', fn: () => simco.getEncyclopedia(realm) },
  ]);
}

/**
 * Get current economy phase with simco → simcotools fallback.
 * @param {number} [realm=0]
 */
export function getEconomyPhase(realm = 0) {
  return _withFallback([
    { id: 'simco',      fn: () => simco.getEconomyPhase(realm) },
    { id: 'simcotools', fn: () => simcotools.getPhase(realm) },
  ]);
}

/**
 * Get retail info (simco only).
 * @param {number} [realm=0]
 */
export function getRetailInfo(realm = 0) {
  return _withFallback([
    { id: 'simco', fn: () => simco.getRetailInfo(realm) },
  ]);
}

/**
 * Get aggregated resource analytics from SimcoTools.
 * Falls back to simco encyclopedia if simcotools is down.
 */
export function getResources() {
  return _withFallback([
    { id: 'simcotools', fn: () => simcotools.getResources() },
    { id: 'simco',      fn: () => simco.getEncyclopedia(0) }, // realm 0 as fallback
  ]);
}

/**
 * Get price history for a resource.
 * @param {number} resourceId
 * @param {number} [realm=0]
 */
export function getResourceHistory(resourceId, realm = 0) {
  return _withFallback([
    { id: 'simcotools', fn: () => simcotools.getResourceHistory(resourceId, realm) },
  ]);
}

/**
 * Return current provider health snapshot (for the diagnostics panel).
 * @returns {Record<string, { failures: number, healthy: boolean }>}
 */
export function healthSnapshot() {
  const out = {};
  for (const [id, h] of _health) {
    out[id] = {
      failures: h.failures,
      healthy:  _isHealthy(id),
      disabledUntil: h.disabledUntil > 0 ? new Date(h.disabledUntil).toISOString() : null,
    };
  }
  return out;
}

/**
 * Manually reset a provider's circuit breaker.
 * @param {string} providerId
 */
export function resetProvider(providerId) {
  _health.delete(providerId);
}
