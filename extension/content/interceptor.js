/**
 * interceptor.js
 * SC Analytics Platform — Feature 1: Live Market Intelligence Overlay
 *
 * COMPLIANCE: Strictly READ-ONLY passive listener.
 * Observes API responses already loaded by the game.
 * Never modifies requests, never triggers automated actions,
 * never clicks, buys, sells, or produces anything.
 */

(function () {
  'use strict';

  // ─── Market endpoint patterns to observe ────────────────────────────────────
  const MARKET_PATTERNS = [
    /\/api\/v[0-9]+\/(0|1)\/market/,
    /\/api\/v[0-9]+\/(0|1)\/resources/,
    /\/api\/v[0-9]+\/pt\/(0|1)\/encyclopedia\/resources/,
    /\/api\/v[0-9]+\/(0|1)\/resources-retail-info/,
    /simcotools\.app\/api\/v[0-9]+\/resources/,
    /api\.simcotools\.com\/v[0-9]+\/realms\/[0-9]+\/(phases|resources)/,
  ];

  function isMarketEndpoint(url) {
    return MARKET_PATTERNS.some((p) => p.test(url));
  }

  // ─── Dispatch normalized data to content pipeline ───────────────────────────
  function dispatchMarketData(url, data) {
    window.dispatchEvent(
      new CustomEvent('SCA_MARKET_DATA', {
        detail: { url, data, timestamp: Date.now() },
      })
    );
    // Also forward to background service worker via messaging
    try {
      chrome.runtime.sendMessage({
        type: 'MARKET_DATA',
        url,
        data,
        ts: Date.now(),
      }).catch(() => {});
    } catch (_) {}
  }

  // ─── Intercept fetch ─────────────────────────────────────────────────────────
  const _origFetch = window.fetch.bind(window);
  window.fetch = async function (...args) {
    const url =
      typeof args[0] === 'string'
        ? args[0]
        : args[0]?.url || '';
    const response = await _origFetch(...args);
    if (isMarketEndpoint(url)) {
      try {
        response
          .clone()
          .json()
          .then((data) => dispatchMarketData(url, data))
          .catch(() => {});
      } catch (_) {}
    }
    return response;
  };

  // ─── Intercept XMLHttpRequest ────────────────────────────────────────────────
  const _XHROpen = XMLHttpRequest.prototype.open;
  const _XHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._sca_url = url;
    return _XHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    const url = this._sca_url || '';
    if (isMarketEndpoint(url)) {
      this.addEventListener('load', () => {
        try {
          const data = JSON.parse(this.responseText);
          dispatchMarketData(url, data);
        } catch (_) {}
      });
    }
    return _XHRSend.apply(this, args);
  };

  console.debug('[SCA] Interceptor active — read-only market analytics listener.');
})();
