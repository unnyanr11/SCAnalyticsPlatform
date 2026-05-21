/**
 * simcotools_adapter.js — SimcoTools third-party API adapter
 *
 * SimcoTools provides aggregated analytics, historical averages,
 * and economy phase data that complements the official SimCo API.
 *
 * Documented endpoints (simcotools.com/docs):
 *   GET https://simcotools.app/api/v3/resources
 *   GET https://api.simcotools.com/v1/realms/{realm}/phases
 *   GET https://api.simcotools.com/v1/realms/{realm}/resources/{id}/history
 *   GET https://api.simcotools.com/v1/realms/{realm}/resources/{id}/market
 *
 * @module services/simcotools_adapter
 */

'use strict';

import { apiFetch }                          from './api_client.js';
import { cache, TTL }                        from './cache.js';
import { ok, err }                           from './schema.js';
import {
  normalizeSimcoToolsResource,
  normalizeSimcoToolsPhase,
  normalizeSimcoMarket,
}                                            from './normalizers.js';

const APP_BASE = 'https://simcotools.app';
const API_BASE = 'https://api.simcotools.com';
const PROVIDER = 'simcotools';

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------
const urls = {
  resources:      ()               => `${APP_BASE}/api/v3/resources`,
  phases:         (realm)          => `${API_BASE}/v1/realms/${realm}/phases`,
  resourceHistory:(realm, id)      => `${API_BASE}/v1/realms/${realm}/resources/${id}/history`,
  resourceMarket: (realm, id)      => `${API_BASE}/v1/realms/${realm}/resources/${id}/market`,
};

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

/**
 * Fetch the SimcoTools aggregated resource catalogue.
 * Includes 24 h / 7 d average prices and volatility scores.
 *
 * @returns {Promise<ReturnType<import('./schema.js').ok>>}
 */
export async function getResources() {
  const cacheKey = 'simcotools:resources';
  const cached   = cache.get(cacheKey);
  if (cached) return ok(cached, `${PROVIDER}:cache`);

  const res = await apiFetch(urls.resources(), { provider: PROVIDER });
  if (!res.ok) return res;

  const raw  = Array.isArray(res.data) ? res.data : (res.data?.data ?? Object.values(res.data ?? {}));
  const data = raw.map(r => normalizeSimcoToolsResource(r)).filter(Boolean);

  cache.set(cacheKey, data, TTL.SIMCOTOOLS);
  return ok(data, PROVIDER);
}

// ---------------------------------------------------------------------------
// Economy Phases
// ---------------------------------------------------------------------------

/**
 * Fetch current economy phase from SimcoTools.
 *
 * @param {number} [realm=0]
 * @returns {Promise<ReturnType<import('./schema.js').ok>>}
 */
export async function getPhase(realm = 0) {
  const cacheKey = `simcotools:phase:${realm}`;
  const cached   = cache.get(cacheKey);
  if (cached) return ok(cached, `${PROVIDER}:cache`);

  const res = await apiFetch(urls.phases(realm), { provider: PROVIDER });
  if (!res.ok) return res;

  // Response may be an array (history) or object (current)
  const raw  = Array.isArray(res.data) ? res.data[0] : res.data;
  const data = normalizeSimcoToolsPhase(raw, realm);
  if (!data) return err(`Cannot normalise phase from SimcoTools for realm ${realm}`, 'NORMALISE_ERROR', PROVIDER);

  cache.set(cacheKey, data, TTL.ECONOMY_PHASE);
  return ok(data, PROVIDER);
}

// ---------------------------------------------------------------------------
// Price History
// ---------------------------------------------------------------------------

/**
 * @typedef {object} PriceHistoryPoint
 * @property {string} ts      - ISO-8601
 * @property {number} price
 * @property {number} volume
 */

/**
 * Fetch price history for a resource.
 *
 * @param {number} resourceId
 * @param {number} [realm=0]
 * @returns {Promise<ReturnType<import('./schema.js').ok>>}
 */
export async function getResourceHistory(resourceId, realm = 0) {
  const cacheKey = `simcotools:history:${realm}:${resourceId}`;
  const cached   = cache.get(cacheKey);
  if (cached) return ok(cached, `${PROVIDER}:cache`);

  const res = await apiFetch(urls.resourceHistory(realm, resourceId), { provider: PROVIDER });
  if (!res.ok) return res;

  const raw  = Array.isArray(res.data) ? res.data : (res.data?.history ?? []);
  const data = raw.map(p => ({
    ts:     new Date(p.timestamp ?? p.ts ?? p.date).toISOString(),
    price:  parseFloat(p.price ?? p.avg_price ?? p.avgPrice ?? 0),
    volume: parseInt(p.volume ?? p.qty ?? 0, 10),
  })).filter(p => isFinite(p.price) && p.price > 0);

  // Cache for 5 minutes — history doesn't change per second
  cache.set(cacheKey, data, 300_000);
  return ok(data, PROVIDER);
}

// ---------------------------------------------------------------------------
// Market (SimcoTools mirror)
// ---------------------------------------------------------------------------

/**
 * Fetch current market data via SimcoTools mirror endpoint.
 * Useful as a fallback when the SimCo API is unreachable.
 *
 * @param {number} resourceId
 * @param {number} [realm=0]
 * @returns {Promise<ReturnType<import('./schema.js').ok>>}
 */
export async function getMarket(resourceId, realm = 0) {
  const cacheKey = `simcotools:market:${realm}:${resourceId}`;
  const cached   = cache.get(cacheKey);
  if (cached) return ok(cached, `${PROVIDER}:cache`);

  const res = await apiFetch(urls.resourceMarket(realm, resourceId), { provider: PROVIDER });
  if (!res.ok) return res;

  const normalised = normalizeSimcoMarket(res.data, resourceId, realm);
  if (!normalised) return err(`Failed to normalise market mirror for resource ${resourceId}`, 'NORMALISE_ERROR', PROVIDER);

  cache.set(cacheKey, normalised, TTL.MARKET);
  return ok(normalised, PROVIDER);
}

/**
 * Lightweight availability check.
 * @returns {Promise<boolean>}
 */
export async function ping() {
  const res = await apiFetch(urls.resources(), { maxRetries: 1, timeoutMs: 5_000, provider: PROVIDER });
  return res.ok;
}
