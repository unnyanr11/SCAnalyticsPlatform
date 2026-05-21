// SC Analytics Platform — API Provider
// Fetches market data from SimCoTools + SimCompanies public APIs with fallback

const REALM = 0;

const ENDPOINTS = {
  simcotools: {
    resources: 'https://simcotools.app/api/v3/resources',
    phases: 'https://api.simcotools.com/v1/realms/0/phases',
    market: (id) => 'https://api.simcotools.com/v1/realms/0/resources/' + id + '/market',
  },
  simcompanies: {
    market: (id) => 'https://www.simcompanies.com/api/v2/market/' + id,
    encyclopedia: (id) => 'https://www.simcompanies.com/api/v4/pt/' + REALM + '/encyclopedia/resources/' + id + '/',
    retailInfo: 'https://www.simcompanies.com/api/v4/' + REALM + '/resources-retail-info/',
    resourcesList: 'https://www.simcompanies.com/api/v4/pt/' + REALM + '/encyclopedia/resources/',
  }
};

const RATE_LIMITS = { windowMs: 60000, maxRequests: 30 };
let requestLog = [];

function canRequest() {
  const now = Date.now();
  requestLog = requestLog.filter(t => now - t < RATE_LIMITS.windowMs);
  if (requestLog.length >= RATE_LIMITS.maxRequests) return false;
  requestLog.push(now);
  return true;
}

async function safeFetch(url, timeout = 8000) {
  if (!canRequest()) { console.warn('[SCA API] Rate limited:', url); return null; }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    console.error('[SCA API] Error:', url, err.message);
    return null;
  }
}

export async function getResources() {
  const data = await safeFetch(ENDPOINTS.simcotools.resources) || await safeFetch(ENDPOINTS.simcompanies.resourcesList);
  return validateResourcesList(data);
}

export async function getMarketData(resourceId) {
  const data = await safeFetch(ENDPOINTS.simcotools.market(resourceId)) || await safeFetch(ENDPOINTS.simcompanies.market(resourceId));
  return validateMarketData(data);
}

export async function getEconomyPhase() {
  const data = await safeFetch(ENDPOINTS.simcotools.phases);
  return validatePhaseData(data);
}

export async function getRetailInfo() {
  return await safeFetch(ENDPOINTS.simcompanies.retailInfo);
}

export async function getResourceEncyclopedia(resourceId) {
  return await safeFetch(ENDPOINTS.simcompanies.encyclopedia(resourceId));
}

function validateResourcesList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.resources && Array.isArray(data.resources)) return data.resources;
  if (data.data && Array.isArray(data.data)) return data.data;
  return [];
}

function validateMarketData(data) {
  if (!data) return null;
  if (Array.isArray(data)) {
    return data.map(item => ({
      price: item.price || item.unitPrice || 0,
      quantity: item.quantity || item.amount || 0,
      quality: item.quality || 0,
      time: item.created || item.timestamp || item.updatedAt || null
    }));
  }
  if (data.listings) return validateMarketData(data.listings);
  return null;
}

function validatePhaseData(data) {
  if (!data) return { phase: 'unknown', index: 0 };
  if (data.phase !== undefined) return data;
  if (data.currentPhase !== undefined) return { phase: data.currentPhase, ...data };
  return { phase: 'stable', ...data };
}
