/**
 * shared/constants/endpoints.ts
 * All API endpoint constants for the SC Analytics Platform.
 *
 * Sources:
 *   - SimCompanies public market API
 *   - SimcoTools analytics API (simcotools.app / api.simcotools.com)
 *   - Local FastAPI backend (/api/v1/)
 *
 * These endpoints are used strictly for READ-ONLY data collection.
 * No automation, account interaction, or game modifications.
 */

// ---------------------------------------------------------------------------
// Realms
// ---------------------------------------------------------------------------

export const REALM_ALPHA = 0;
export const REALM_BETA  = 1;

// ---------------------------------------------------------------------------
// SimCompanies base URLs
// ---------------------------------------------------------------------------

export const SIMCO_BASE = 'https://www.simcompanies.com';

/**
 * SimCompanies market endpoint for a single item.
 * Replace {itemId} with the numeric resource/product ID.
 */
export const SIMCO_MARKET_ITEM = (itemId: number): string =>
  `${SIMCO_BASE}/api/v2/market/${itemId}`;

/**
 * SimCompanies encyclopedia for a realm (all resources).
 */
export const SIMCO_ENCYCLOPEDIA = (realm: number): string =>
  `${SIMCO_BASE}/api/v4/pt/${realm}/encyclopedia/resources`;

/**
 * SimCompanies retail / NPC price info.
 */
export const SIMCO_RETAIL_INFO = (realm: number): string =>
  `${SIMCO_BASE}/api/v4/${realm}/resources-retail-info/`;

/**
 * SimCompanies company info (read-only, public endpoint).
 */
export const SIMCO_COMPANY = (companyId: number): string =>
  `${SIMCO_BASE}/api/v2/company/${companyId}`;

// ---------------------------------------------------------------------------
// SimcoTools base URLs
// ---------------------------------------------------------------------------

export const SIMCOTOOLS_APP_BASE = 'https://simcotools.app';
export const SIMCOTOOLS_API_BASE = 'https://api.simcotools.com';

/**
 * SimcoTools v3 resources (aggregated analytics per resource).
 */
export const SIMCOTOOLS_RESOURCES = `${SIMCOTOOLS_APP_BASE}/api/v3/resources`;

/**
 * SimcoTools v3 single resource.
 */
export const SIMCOTOOLS_RESOURCE = (resourceId: number): string =>
  `${SIMCOTOOLS_APP_BASE}/api/v3/resources/${resourceId}`;

/**
 * SimcoTools economy phase endpoint.
 */
export const SIMCOTOOLS_PHASES = (realm: number): string =>
  `${SIMCOTOOLS_API_BASE}/v1/realms/${realm}/phases`;

/**
 * SimcoTools historical price data.
 */
export const SIMCOTOOLS_HISTORY = (resourceId: number): string =>
  `${SIMCOTOOLS_APP_BASE}/api/v3/resources/${resourceId}/history`;

// ---------------------------------------------------------------------------
// Local backend (FastAPI)
// ---------------------------------------------------------------------------

export const BACKEND_BASE = 'http://localhost:8000';
export const BACKEND_API  = `${BACKEND_BASE}/api/v1`;

export const BACKEND_ENDPOINTS = {
  health:          `${BACKEND_BASE}/health`,
  marketPrices:    `${BACKEND_API}/market/prices`,
  marketItem:      (id: number) => `${BACKEND_API}/market/prices/${id}`,
  predictions:     `${BACKEND_API}/ai/predictions`,
  predictionItem:  (id: number) => `${BACKEND_API}/ai/predictions/${id}`,
  heatmap:         `${BACKEND_API}/market/heatmap`,
  shortages:       `${BACKEND_API}/market/shortages`,
  arbitrage:       `${BACKEND_API}/market/arbitrage`,
  economyPhase:    `${BACKEND_API}/economy/phase`,
  economyStrategy: `${BACKEND_API}/economy/strategy`,
  production:      `${BACKEND_API}/production/optimize`,
  portfolio:       `${BACKEND_API}/portfolio`,
  alerts:          `${BACKEND_API}/alerts`,
  alertMarkRead:   (id: string) => `${BACKEND_API}/alerts/${id}/read`,
  assistant:       `${BACKEND_API}/assistant/query`,
  settings:        `${BACKEND_API}/settings`,
} as const;

// ---------------------------------------------------------------------------
// Polling defaults (milliseconds)
// ---------------------------------------------------------------------------

export const POLLING_INTERVALS = {
  marketData:    30_000,   // 30 s  — market prices
  economyPhase:  60_000,   // 60 s  — economy phase changes slowly
  predictions:   120_000,  // 2 min — AI predictions
  alerts:        15_000,   // 15 s  — shortage/spike alerts
  portfolio:     60_000,   // 60 s  — portfolio valuation
} as const;

// ---------------------------------------------------------------------------
// Rate limits (requests per minute per base URL)
// ---------------------------------------------------------------------------

export const RATE_LIMITS = {
  simco:       20,  // conservative SimCompanies limit
  simcotools:  30,  // SimcoTools analytics API
  backend:    120,  // local backend — no external constraint
} as const;

// ---------------------------------------------------------------------------
// Cache TTLs (seconds)
// ---------------------------------------------------------------------------

export const CACHE_TTL = {
  marketItem:    30,
  resources:    300,
  retailInfo:   120,
  economyPhase:  60,
  predictions:  120,
} as const;

// ---------------------------------------------------------------------------
// SimCompanies URL patterns (for content script matching)
// ---------------------------------------------------------------------------

export const SIMCO_URL_PATTERNS = {
  market:        /simcompanies\.com.*\/market/,
  company:       /simcompanies\.com.*\/company/,
  production:    /simcompanies\.com.*\/production/,
  research:      /simcompanies\.com.*\/research/,
  any:           /simcompanies\.com/,
} as const;
