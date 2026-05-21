/**
 * simco_adapter.js — SimCompanies official API adapter
 *
 * Calls SimCompanies public/authenticated endpoints and returns
 * normalised shapes from schema.js.
 *
 * Endpoint reference (community-documented):
 *   GET /api/v2/market/{itemId}?realm={realm}
 *   GET /api/v4/pt/{realm}/encyclopedia/resources/{id}/
 *   GET /api/v4/pt/{realm}/encyclopedia/resources/
 *   GET /api/v4/{realm}/resources-retail-info/
 *   GET (phase endpoint — community-discovered, realm-specific)
 *
 * @module services/simco_adapter
 */

'use strict';

import { apiFetch }                    from './api_client.js';
import { cache, TTL }                  from './cache.js';
import { ok, err }                     from './schema.js';
import {
  normalizeSimcoMarket,
  normalizeSimcoResource,
  normalizeSimcoPhase,
  normalizeSimcoRetailInfo,
}                                      from './normalizers.js';

const BASE   = 'https://www.simcompanies.com';
const PROVIDER = 'simco';

// ---------------------------------------------------------------------------
// URL builders — centralised so a game update only needs one change here
// ---------------------------------------------------------------------------
const urls = {
  market:       (itemId, realm)  => `${BASE}/api/v2/market/${itemId}?realm=${realm}`,
  encyclopediaAll: (realm)       => `${BASE}/api/v4/pt/${realm}/encyclopedia/resources/`,
  encyclopediaOne: (realm, id)   => `${BASE}/api/v4/pt/${realm}/encyclopedia/resources/${id}/`,
  retailInfo:   (realm)          => `${BASE}/api/v4/${realm}/resources-retail-info/`,
  // Phase endpoint varies; try both known patterns
  phaseV2:      (realm)          => `${BASE}/api/v2/gamephase?realm=${realm}`,
  phaseV4:      (realm)          => `${BASE}/api/v4/${realm}/gamephase/`,
};

// ---------------------------------------------------------------------------
// Market
// ---------------------------------------------------------------------------

/**
 * Fetch live market offers for a product.
 *
 * @param {number}  productId
 * @param {number}  [realm=0]  0 = Alpha, 1 = Beta
 * @returns {Promise<ReturnType<import('./schema.js').ok>>}
 */
export async function getMarket(productId, realm = 0) {
  const cacheKey = `simco:market:${realm}:${productId}`;
  const cached   = cache.get(cacheKey);
  if (cached) return ok(cached, `${PROVIDER}:cache`);

  const res = await apiFetch(urls.market(productId, realm), { provider: PROVIDER });
  if (!res.ok) return res;

  const normalised = normalizeSimcoMarket(res.data, productId, realm);
  if (!normalised) return err(`Failed to normalise market data for product ${productId}`, 'NORMALISE_ERROR', PROVIDER);

  cache.set(cacheKey, normalised, TTL.MARKET);
  return ok(normalised, PROVIDER);
}

// ---------------------------------------------------------------------------
// Encyclopedia
// ---------------------------------------------------------------------------

/**
 * Fetch the full encyclopedia for a realm (all resources).
 *
 * @param {number} [realm=0]
 * @returns {Promise<ReturnType<import('./schema.js').ok>>}
 */
export async function getEncyclopedia(realm = 0) {
  const cacheKey = `simco:encyclopedia:${realm}`;
  const cached   = cache.get(cacheKey);
  if (cached) return ok(cached, `${PROVIDER}:cache`);

  const res = await apiFetch(urls.encyclopediaAll(realm), { provider: PROVIDER });
  if (!res.ok) return res;

  const raw  = Array.isArray(res.data) ? res.data : Object.values(res.data ?? {});
  const data = raw.map(r => normalizeSimcoResource(r, realm)).filter(Boolean);

  cache.set(cacheKey, data, TTL.ENCYCLOPEDIA);
  return ok(data, PROVIDER);
}

/**
 * Fetch a single resource from the encyclopedia.
 *
 * @param {number} resourceId
 * @param {number} [realm=0]
 * @returns {Promise<ReturnType<import('./schema.js').ok>>}
 */
export async function getResource(resourceId, realm = 0) {
  const cacheKey = `simco:resource:${realm}:${resourceId}`;
  const cached   = cache.get(cacheKey);
  if (cached) return ok(cached, `${PROVIDER}:cache`);

  const res = await apiFetch(urls.encyclopediaOne(realm, resourceId), { provider: PROVIDER });
  if (!res.ok) return res;

  const data = normalizeSimcoResource(res.data, realm);
  if (!data) return err(`Failed to normalise resource ${resourceId}`, 'NORMALISE_ERROR', PROVIDER);

  cache.set(cacheKey, data, TTL.ENCYCLOPEDIA);
  return ok(data, PROVIDER);
}

// ---------------------------------------------------------------------------
// Economy Phase
// ---------------------------------------------------------------------------

/**
 * Fetch current economy phase, trying two known endpoint patterns.
 *
 * @param {number} [realm=0]
 * @returns {Promise<ReturnType<import('./schema.js').ok>>}
 */
export async function getEconomyPhase(realm = 0) {
  const cacheKey = `simco:phase:${realm}`;
  const cached   = cache.get(cacheKey);
  if (cached) return ok(cached, `${PROVIDER}:cache`);

  // Try v4 first, fall back to v2
  for (const urlFn of [urls.phaseV4, urls.phaseV2]) {
    const res = await apiFetch(urlFn(realm), { provider: PROVIDER });
    if (!res.ok) continue;

    const raw  = Array.isArray(res.data) ? res.data[0] : res.data;
    const data = normalizeSimcoPhase(raw, realm);
    if (!data) continue;

    cache.set(cacheKey, data, TTL.ECONOMY_PHASE);
    return ok(data, PROVIDER);
  }

  return err(`Could not fetch economy phase for realm ${realm}`, 'PHASE_UNAVAILABLE', PROVIDER);
}

// ---------------------------------------------------------------------------
// Retail Info
// ---------------------------------------------------------------------------

/**
 * Fetch retail pricing info for all tradeable resources.
 *
 * @param {number} [realm=0]
 * @returns {Promise<ReturnType<import('./schema.js').ok>>}
 */
export async function getRetailInfo(realm = 0) {
  const cacheKey = `simco:retail:${realm}`;
  const cached   = cache.get(cacheKey);
  if (cached) return ok(cached, `${PROVIDER}:cache`);

  const res = await apiFetch(urls.retailInfo(realm), { provider: PROVIDER });
  if (!res.ok) return res;

  const raw  = Array.isArray(res.data) ? res.data : Object.values(res.data ?? {});
  const data = raw.map(r => normalizeSimcoRetailInfo(r, realm)).filter(Boolean);

  cache.set(cacheKey, data, TTL.RETAIL_INFO);
  return ok(data, PROVIDER);
}

// ---------------------------------------------------------------------------
// Validation helper — quickly test if the SimCo API is reachable
// ---------------------------------------------------------------------------

/**
 * Lightweight health-check. Fetches the steel (id=4) market.
 * @returns {Promise<boolean>}
 */
export async function ping(realm = 0) {
  const res = await apiFetch(urls.market(4, realm), {
    provider: PROVIDER,
    maxRetries: 1,
    timeoutMs: 5_000,
  });
  return res.ok;
}
