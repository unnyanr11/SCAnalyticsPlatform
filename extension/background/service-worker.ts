/**
 * SC Analytics Platform — Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 *   - Receive market data forwarded from content scripts
 *   - Cache and aggregate data in chrome.storage.local
 *   - Communicate with backend analytics API
 *   - Manage alert state
 *
 * This service worker NEVER performs any automated game actions.
 */

import type { MarketDataMessage } from '../../shared/types/market';

const BACKEND_BASE_URL = 'http://localhost:8000';
const CACHE_TTL_MS = 60_000; // 1 minute

// ------------------------------------------------------------------
// Message Router
// ------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (message: MarketDataMessage, _sender, sendResponse) => {
    if (message.type === 'MARKET_DATA_INTERCEPTED') {
      handleMarketData(message)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true; // Keep message channel open for async response
    }
  }
);

// ------------------------------------------------------------------
// Data Handlers
// ------------------------------------------------------------------

async function handleMarketData(message: MarketDataMessage): Promise<void> {
  // Persist raw snapshot to local storage (keyed by URL)
  const key = `sca_market_${encodeURIComponent(message.url)}`;
  await chrome.storage.local.set({
    [key]: {
      data: message.data,
      cachedAt: message.timestamp,
      expiresAt: message.timestamp + CACHE_TTL_MS,
    },
  });

  // Forward to backend for AI analysis (non-blocking)
  forwardToBackend(message).catch(console.warn);
}

async function forwardToBackend(message: MarketDataMessage): Promise<void> {
  await fetch(`${BACKEND_BASE_URL}/api/v1/market/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: message.url,
      data: message.data,
      timestamp: message.timestamp,
    }),
  });
}

// ------------------------------------------------------------------
// Alarm — periodic cache eviction
// ------------------------------------------------------------------

chrome.alarms.create('sca-cache-evict', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'sca-cache-evict') return;

  const all = await chrome.storage.local.get(null);
  const now = Date.now();
  const staleKeys: string[] = [];

  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith('sca_market_') && (value as { expiresAt: number }).expiresAt < now) {
      staleKeys.push(key);
    }
  }

  if (staleKeys.length > 0) {
    await chrome.storage.local.remove(staleKeys);
  }
});

export {};
