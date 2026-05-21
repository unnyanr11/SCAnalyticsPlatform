/**
 * normalizer.js
 * SC Analytics Platform — Feature 1: Live Market Intelligence Overlay
 *
 * Normalizes raw API responses from multiple endpoints/schemas
 * into a unified MarketItem format consumed by scorer and overlay injector.
 * Handles schema differences, missing fields, and version changes gracefully.
 */

(function () {
  'use strict';

  // ─── Unified item schema ───────────────────────────────────────────────────
  /**
   * @typedef {Object} MarketItem
   * @property {number}  id
   * @property {string}  name
   * @property {number}  price          — latest market price
   * @property {number}  quantity       — available quantity
   * @property {number}  retailPrice    — NPC retail price (0 if unknown)
   * @property {number}  productionCost — estimated production cost (0 if unknown)
   * @property {string}  category
   * @property {number}  quality        — item quality tier (0–4)
   * @property {number}  timestamp      — unix ms when data was captured
   * @property {string}  source         — originating endpoint URL
   * @property {Array}   history        — last N price snapshots [{price, qty, ts}]
   */

  function emptyItem(overrides = {}) {
    return {
      id: 0,
      name: 'Unknown',
      price: 0,
      quantity: 0,
      retailPrice: 0,
      productionCost: 0,
      category: 'unknown',
      quality: 0,
      timestamp: Date.now(),
      source: '',
      history: [],
      ...overrides,
    };
  }

  // ─── Schema detectors ──────────────────────────────────────────────────────

  /** SimCo /api/v2/market/{id} — array of offers */
  function isSimcoMarketV2(data) {
    return Array.isArray(data) && data[0]?.kind !== undefined && data[0]?.price !== undefined;
  }

  /** SimcoTools /api/v3/resources — array with price/stats */
  function isSimcoToolsResources(data) {
    return Array.isArray(data) && data[0]?.id !== undefined && data[0]?.avg_price !== undefined;
  }

  /** SimCo resources-retail-info */
  function isRetailInfo(data) {
    return Array.isArray(data) && data[0]?.retail_price !== undefined;
  }

  /** SimCo encyclopedia resources */
  function isEncyclopedia(data) {
    return Array.isArray(data) && data[0]?.db_letter !== undefined;
  }

  // ─── Normalizers per schema ───────────────────────────────────────────────────

  function normalizeSimcoMarketV2(offers, url) {
    if (!offers.length) return [];
    // Group by item kind
    const byKind = {};
    for (const offer of offers) {
      const id = offer.kind ?? offer.resource ?? 0;
      if (!byKind[id]) {
        byKind[id] = {
          id,
          name: offer.kind_name ?? offer.name ?? `Item ${id}`,
          price: Infinity,
          quantity: 0,
          retailPrice: 0,
          productionCost: 0,
          category: offer.category ?? 'unknown',
          quality: offer.quality ?? 0,
          timestamp: Date.now(),
          source: url,
          history: [],
        };
      }
      // Track lowest ask price and total quantity
      if ((offer.price ?? 0) < byKind[id].price) byKind[id].price = offer.price;
      byKind[id].quantity += offer.quantity ?? 1;
    }
    return Object.values(byKind).map((item) => ({
      ...item,
      price: item.price === Infinity ? 0 : item.price,
    }));
  }

  function normalizeSimcoToolsResources(resources, url) {
    return resources.map((r) =>
      emptyItem({
        id: r.id ?? 0,
        name: r.name ?? `Resource ${r.id}`,
        price: r.market_price ?? r.avg_price ?? r.price ?? 0,
        quantity: r.market_quantity ?? r.quantity ?? 0,
        retailPrice: r.retail_price ?? 0,
        productionCost: r.production_cost ?? 0,
        category: r.category ?? r.kind ?? 'unknown',
        quality: r.quality ?? 0,
        timestamp: Date.now(),
        source: url,
      })
    );
  }

  function normalizeRetailInfo(items, url) {
    return items.map((r) =>
      emptyItem({
        id: r.id ?? r.kind ?? 0,
        name: r.name ?? `Item ${r.id}`,
        price: r.market_price ?? 0,
        retailPrice: r.retail_price ?? 0,
        productionCost: r.production_cost ?? 0,
        category: r.category ?? 'unknown',
        quality: r.quality ?? 0,
        timestamp: Date.now(),
        source: url,
      })
    );
  }

  function normalizeEncyclopedia(items, url) {
    return items.map((r) =>
      emptyItem({
        id: r.id ?? 0,
        name: r.name ?? `Item ${r.id}`,
        price: r.market_price ?? 0,
        retailPrice: r.retail_price ?? 0,
        productionCost: r.production_cost ?? 0,
        category: r.category ?? 'unknown',
        quality: r.quality ?? 0,
        timestamp: Date.now(),
        source: url,
      })
    );
  }

  // ─── Main normalize entry point ─────────────────────────────────────────────────

  /**
   * Normalizes raw API response data into an array of MarketItem objects.
   * Validates the response structure and returns empty array on unknown schema.
   * @param {string} url — source endpoint URL
   * @param {*} data — raw parsed JSON
   * @returns {MarketItem[]}
   */
  function normalize(url, data) {
    try {
      if (!data) return [];
      const list = Array.isArray(data) ? data : [data];
      if (!list.length) return [];

      if (isSimcoMarketV2(list)) return normalizeSimcoMarketV2(list, url);
      if (isSimcoToolsResources(list)) return normalizeSimcoToolsResources(list, url);
      if (isRetailInfo(list)) return normalizeRetailInfo(list, url);
      if (isEncyclopedia(list)) return normalizeEncyclopedia(list, url);

      // Fallback: best-effort extraction
      return list
        .filter((r) => r && typeof r === 'object')
        .map((r) =>
          emptyItem({
            id: r.id ?? r.kind ?? r.resource ?? 0,
            name: r.name ?? r.kind_name ?? `Item ${r.id ?? 0}`,
            price: r.price ?? r.market_price ?? r.avg_price ?? 0,
            quantity: r.quantity ?? r.available ?? 0,
            retailPrice: r.retail_price ?? 0,
            category: r.category ?? 'unknown',
            quality: r.quality ?? 0,
            source: url,
          })
        );
    } catch (err) {
      console.warn('[SCA Normalizer] Failed to normalize response from', url, err);
      return [];
    }
  }

  // ─── Listen to interceptor events and re-dispatch normalized items ───────────────
  window.addEventListener('SCA_MARKET_DATA', (event) => {
    const { url, data } = event.detail;
    const items = normalize(url, data);
    if (items.length) {
      window.dispatchEvent(
        new CustomEvent('SCA_NORMALIZED_ITEMS', {
          detail: { items, source: url, timestamp: Date.now() },
        })
      );
    }
  });

  // Expose globally for scorer and overlay-injector
  window.SCANormalizer = { normalize };

  console.debug('[SCA] Normalizer active.');
})();
