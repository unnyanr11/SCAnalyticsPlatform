/**
 * SC Analytics Platform — Extension Constants
 */

// Backend API base URL (localhost for development, configurable via env)
export const BACKEND_URL =
  (typeof __DEV__ !== 'undefined' && __DEV__)
    ? 'http://localhost:8000'
    : 'http://localhost:8000'; // Update to production URL when deployed

// Cache TTL in milliseconds
export const CACHE_TTL_MS = 60_000; // 1 minute for market data

// Alarm intervals
export const ALARM_INTERVAL_MINUTES = {
  CACHE_EVICT: 5,
  PHASE_POLL:  15,
} as const;

// Sim Companies & SimcoTools endpoints
export const SC_ENDPOINTS = {
  MARKET:      (itemId: number, realm = 0) =>
    `https://www.simcompanies.com/api/v2/market/${itemId}/?realm=${realm}`,
  ENCYCLOPEDIA: (realm = 0) =>
    `https://www.simcompanies.com/api/v4/pt/${realm}/encyclopedia/resources/`,
  RETAIL_INFO:  (realm = 0) =>
    `https://www.simcompanies.com/api/v4/${realm}/resources-retail-info/`,
} as const;

export const SIMCOTOOLS_ENDPOINTS = {
  RESOURCES:    'https://simcotools.app/api/v3/resources',
  PHASE:        (realm = 0) => `https://api.simcotools.com/v1/realms/${realm}/phases`,
} as const;

// Patterns to identify market API calls
export const MARKET_URL_PATTERNS: RegExp[] = [
  /simcompanies\.com\/api/,
  /simcotools\.app\/api/,
  /api\.simcotools\.com/,
];

// Rate limiting
export const REQUEST_DELAY_MS = 500;

// Overlay
export const OVERLAY_ROOT_ID = 'sca-overlay-root';
export const OVERLAY_STYLE_ID = 'sca-overlay-styles';
