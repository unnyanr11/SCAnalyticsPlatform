/**
 * SC Analytics Platform — Content Script (updated)
 *
 * Injected into https://www.simcompanies.com/* pages.
 *
 * STRICTLY PROHIBITED:
 *   - Clicking any game element
 *   - Submitting any form
 *   - Triggering buy/sell/produce actions
 *   - Modifying game state
 *   - Accessing or mutating account data
 */

import type { MarketDataMessage } from '../../shared/types/market';

// ────────────────────────────────────────────────────────────────────
// Network interception — read-only, passive observation
// ────────────────────────────────────────────────────────────────────

const originalFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const response = await originalFetch(input, init);
  const cloned = response.clone();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  if (isMarketEndpoint(url)) {
    cloned
      .json()
      .then((data: unknown) => {
        const message: MarketDataMessage = {
          type: 'MARKET_DATA_INTERCEPTED',
          url,
          data,
          timestamp: Date.now(),
        };
        chrome.runtime.sendMessage(message).catch(() => { /* SW not ready yet */ });
      })
      .catch(() => { /* Non-JSON, skip */ });
  }

  return response;
};

function isMarketEndpoint(url: string): boolean {
  return (
    url.includes('simcompanies.com/api') ||
    url.includes('simcotools.app/api') ||
    url.includes('api.simcotools.com')
  );
}

// ────────────────────────────────────────────────────────────────────
// Overlay injection system initialisation
// ────────────────────────────────────────────────────────────────────

// Dynamic import to keep the content script bundle small on initial load.
// The overlay system (React + Shadow DOM) loads asynchronously after the
// page is interactive.
(async () => {
  try {
    const { initOverlaySystem } = await import('../src/overlay/contentBridge');
    initOverlaySystem();
  } catch (err) {
    console.warn('[SCAnalytics] Overlay system failed to initialise:', err);
  }
})();

export {};
