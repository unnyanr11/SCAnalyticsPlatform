/**
 * normalizers.js — Raw API response → Unified Internal Schema
 *
 * Each function accepts the raw JSON from a specific provider/endpoint
 * and returns a shape defined in schema.js.
 *
 * Normalizers must:
 *  - Never throw — return null for invalid records so callers can filter
 *  - Coerce types (string → number, missing → default)
 *  - Sanitise values (negative prices → 0, etc.)
 *
 * @module services/normalizers
 */

'use strict';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const safeNum   = (v, fallback = 0) => { const n = parseFloat(v); return isFinite(n) ? n : fallback; };
const safeInt   = (v, fallback = 0) => { const n = parseInt(v, 10); return isFinite(n) ? n : fallback; };
const clamp     = (v, min, max) => Math.max(min, Math.min(max, v));
const isoNow    = () => new Date().toISOString();
const toISO     = v  => { try { return new Date(v).toISOString(); } catch { return isoNow(); } };

// ---------------------------------------------------------------------------
// SimCompanies — market offers  (/api/v2/market/{itemId})
// ---------------------------------------------------------------------------

/**
 * Normalise a single raw market offer from SimCompanies.
 *
 * @param {object} raw    - One element from the API array
 * @param {number} realm
 * @returns {import('./schema.js').MarketOffer|null}
 */
export function normalizeSimcoOffer(raw, realm) {
  if (!raw || typeof raw !== 'object') return null;
  const price = safeNum(raw.price ?? raw.Price);
  const qty   = safeInt(raw.quantity ?? raw.Quantity ?? raw.qty);
  if (price <= 0 || qty <= 0) return null;

  return {
    productId: safeInt(raw.resource ?? raw.resourceId ?? raw.id),
    realm,
    price,
    quantity: qty,
    quality:  clamp(safeInt(raw.quality ?? raw.Quality), 0, 3),
    sellerId: String(raw.seller?.id ?? raw.sellerId ?? raw.company ?? ''),
    listedAt: toISO(raw.posted ?? raw.listedAt ?? raw.created_at),
  };
}

/**
 * Normalise a full SimCompanies market response into a MarketSnapshot.
 *
 * @param {any}    raw
 * @param {number} productId
 * @param {number} realm
 * @returns {import('./schema.js').MarketSnapshot|null}
 */
export function normalizeSimcoMarket(raw, productId, realm) {
  // SimCo returns an array of offers directly
  const offerList = Array.isArray(raw) ? raw : (raw?.offers ?? raw?.data ?? []);
  const offers = offerList
    .map(o => normalizeSimcoOffer(o, realm))
    .filter(Boolean)
    .sort((a, b) => a.price - b.price);

  if (offers.length === 0) {
    return {
      productId, realm,
      lowestAsk: 0, highestAsk: 0, vwap: 0,
      totalSupply: 0, offerCount: 0,
      offers: [],
      fetchedAt: isoNow(),
    };
  }

  const totalQty   = offers.reduce((s, o) => s + o.quantity, 0);
  const totalValue = offers.reduce((s, o) => s + o.price * o.quantity, 0);

  return {
    productId,
    realm,
    lowestAsk:   offers[0].price,
    highestAsk:  offers[offers.length - 1].price,
    vwap:        totalQty > 0 ? totalValue / totalQty : 0,
    totalSupply: totalQty,
    offerCount:  offers.length,
    offers,
    fetchedAt:   isoNow(),
  };
}

// ---------------------------------------------------------------------------
// SimCompanies — encyclopedia resource  (/api/v4/pt/{realm}/encyclopedia/resources/)
// ---------------------------------------------------------------------------

/**
 * @param {object} raw
 * @param {number} realm
 * @returns {import('./schema.js').ResourceInfo|null}
 */
export function normalizeSimcoResource(raw, realm) {
  if (!raw || typeof raw !== 'object') return null;
  const id = safeInt(raw.id ?? raw.dbLetter ?? raw.resourceId);
  if (!id) return null;

  // inputs can be under `inputs`, `recipe`, or `resources`
  const rawInputs = raw.inputs ?? raw.recipe ?? raw.resources ?? [];
  const inputs = Array.isArray(rawInputs)
    ? rawInputs.map(i => ({
        resourceId: safeInt(i.resource ?? i.resourceId ?? i.id),
        quantity:   safeNum(i.quantity ?? i.amount ?? i.qty),
      })).filter(i => i.resourceId > 0)
    : [];

  return {
    id,
    realm,
    key:            String(raw.key ?? raw.name_key ?? '').toLowerCase(),
    name:           String(raw.name ?? raw.label ?? ''),
    category:       String(raw.kind ?? raw.category ?? '').toLowerCase(),
    retailPrice:    safeNum(raw.retailPrice ?? raw.retail_price ?? raw.retail),
    transportCost:  safeNum(raw.transportationCost ?? raw.transport_cost ?? raw.transport),
    unitsPerRun:    safeInt(raw.unitsPerRun ?? raw.units_per_run ?? raw.output ?? 1),
    productionTime: safeInt(raw.productionTime ?? raw.production_time ?? raw.time ?? 0),
    isRawMaterial:  Boolean(raw.rawMaterial ?? raw.raw_material ?? raw.natural_resource),
    inputs,
  };
}

// ---------------------------------------------------------------------------
// SimCompanies — economy phase  (phase endpoint)
// ---------------------------------------------------------------------------

/**
 * @param {object} raw
 * @param {number} realm
 * @returns {import('./schema.js').EconomyPhase|null}
 */
export function normalizeSimcoPhase(raw, realm) {
  if (!raw || typeof raw !== 'object') return null;

  const PHASE_NAMES = { 0: 'Stable', 1: 'Boom', 2: 'Recession', 3: 'Recovery' };
  const MULTIPLIERS = { 0: 1.0,     1: 1.25,  2: 0.80,        3: 0.95 };

  const code = safeInt(raw.phase ?? raw.phaseCode ?? raw.state ?? 0);

  return {
    realm,
    phaseCode:  code,
    phaseName:  raw.phaseName ?? raw.name ?? PHASE_NAMES[code] ?? 'Unknown',
    multiplier: safeNum(raw.multiplier ?? MULTIPLIERS[code] ?? 1.0),
    fetchedAt:  isoNow(),
  };
}

// ---------------------------------------------------------------------------
// SimCompanies — retail info  (/api/v4/{realm}/resources-retail-info/)
// ---------------------------------------------------------------------------

/**
 * @param {object} raw    - one element from the retail-info array
 * @param {number} realm
 * @returns {import('./schema.js').RetailInfo|null}
 */
export function normalizeSimcoRetailInfo(raw, realm) {
  if (!raw || typeof raw !== 'object') return null;
  const productId = safeInt(raw.resource ?? raw.id ?? raw.productId);
  if (!productId) return null;

  return {
    productId,
    realm,
    retailPrice:    safeNum(raw.retailPrice ?? raw.retail_price ?? raw.price),
    maxRetailPrice: safeNum(raw.maxRetailPrice ?? raw.max_retail_price ?? raw.maxPrice),
    demand:         clamp(safeNum(raw.demand ?? raw.demandFactor ?? 0), 0, 1),
    fetchedAt:      isoNow(),
  };
}

// ---------------------------------------------------------------------------
// SimcoTools — resources  (https://simcotools.app/api/v3/resources)
// ---------------------------------------------------------------------------

/**
 * @param {object} raw
 * @returns {import('./schema.js').SimcoToolsResource|null}
 */
export function normalizeSimcoToolsResource(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = safeInt(raw.id ?? raw.resourceId);
  if (!id) return null;

  return {
    id,
    key:          String(raw.key ?? raw.slug ?? '').toLowerCase(),
    name:         String(raw.name ?? ''),
    category:     String(raw.kind ?? raw.category ?? '').toLowerCase(),
    avgPrice24h:  raw.avgPrice24h != null ? safeNum(raw.avgPrice24h) : null,
    avgPrice7d:   raw.avgPrice7d  != null ? safeNum(raw.avgPrice7d)  : null,
    avgVolume24h: raw.avgVolume24h != null ? safeNum(raw.avgVolume24h) : null,
    volatility:   safeNum(raw.volatility ?? raw.priceVolatility ?? 0),
    fetchedAt:    isoNow(),
  };
}

// ---------------------------------------------------------------------------
// SimcoTools — phases  (https://api.simcotools.com/v1/realms/{realm}/phases)
// ---------------------------------------------------------------------------

/**
 * @param {object} raw
 * @param {number} realm
 * @returns {import('./schema.js').EconomyPhase|null}
 */
export function normalizeSimcoToolsPhase(raw, realm) {
  if (!raw || typeof raw !== 'object') return null;

  const PHASE_MAP = {
    stable:   { code: 0, multiplier: 1.00 },
    boom:     { code: 1, multiplier: 1.25 },
    recession:{ code: 2, multiplier: 0.80 },
    recovery: { code: 3, multiplier: 0.95 },
  };

  const nameRaw = String(raw.phase ?? raw.name ?? raw.state ?? 'stable').toLowerCase();
  const mapped  = PHASE_MAP[nameRaw] ?? PHASE_MAP.stable;

  return {
    realm,
    phaseCode:  mapped.code,
    phaseName:  nameRaw.charAt(0).toUpperCase() + nameRaw.slice(1),
    multiplier: safeNum(raw.multiplier ?? mapped.multiplier),
    fetchedAt:  isoNow(),
  };
}
