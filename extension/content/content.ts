/**
 * SC Analytics Platform — Content Script
 *
 * Injected into https://www.simcompanies.com/* pages.
 *
 * Responsibilities:
 *   - Intercept existing fetch/XHR responses from Sim Companies APIs
 *   - Forward market data to the background service worker
 *   - Inject lightweight overlay badges into relevant DOM elements
 *
 * STRICTLY PROHIBITED (enforced by code review and linting):
 *   - Clicking any game element
 *   - Submitting any form
 *   - Triggering buy/sell/produce actions
 *   - Modifying game state
 *   - Accessing or mutating account data
 */

import type { MarketDataMessage } from '../../shared/types/market';

// ------------------------------------------------------------------
// Network interception (read-only, passive observation)
// ------------------------------------------------------------------

const originalFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const response = await originalFetch(input, init);

  // Clone so the original stream is untouched
  const cloned = response.clone();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Only forward Sim Companies / SimcoTools market endpoints
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
        chrome.runtime.sendMessage(message).catch(() => {
          // Background may not be ready yet — safe to ignore
        });
      })
      .catch(() => {
        // Non-JSON responses — skip silently
      });
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

// ------------------------------------------------------------------
// Overlay injection (display-only, non-interactive)
// ------------------------------------------------------------------

function injectOverlayStyles(): void {
  if (document.getElementById('sca-overlay-styles')) return;
  const style = document.createElement('style');
  style.id = 'sca-overlay-styles';
  style.textContent = `
    .sca-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 500;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 6px;
      pointer-events: none;
      user-select: none;
      z-index: 9999;
    }
    .sca-badge--bullish { background: rgba(63,185,80,0.15); color: #3fb950; border: 1px solid rgba(63,185,80,0.3); }
    .sca-badge--bearish { background: rgba(248,81,73,0.15); color: #f85149; border: 1px solid rgba(248,81,73,0.3); }
    .sca-badge--warning { background: rgba(210,153,34,0.15); color: #d29922; border: 1px solid rgba(210,153,34,0.3); }
    .sca-badge--neutral { background: rgba(139,148,158,0.15); color: #8b949e; border: 1px solid rgba(139,148,158,0.3); }
  `;
  document.head.appendChild(style);
}

injectOverlayStyles();

export {};
