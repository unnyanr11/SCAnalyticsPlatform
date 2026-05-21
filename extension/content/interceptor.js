// SC Analytics Platform — Request Interceptor
// Passively captures API responses already loaded by the game. No extra requests made.

(function () {
  'use strict';

  const WATCHED_PATTERNS = [
    /\/api\/v[24]\/(0|1)\/market/,
    /\/api\/v[24]\/(0|1)\/resources/,
    /\/api\/v[24]\/pt\/(0|1)\/encyclopedia/,
    /\/api\/v[24]\/(0|1)\/resources-retail-info/,
    /simcotools\.app\/api/,
    /api\.simcotools\.com/
  ];

  function shouldCapture(url) {
    return WATCHED_PATTERNS.some(pat => pat.test(url));
  }

  function dispatchData(url, data) {
    window.dispatchEvent(new CustomEvent('SCA_API_DATA', { detail: { url, data, ts: Date.now() } }));
  }

  // Intercept fetch
  const origFetch = window.fetch.bind(window);
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
    const response = await origFetch(...args);
    if (shouldCapture(url)) {
      try { response.clone().json().then(data => dispatchData(url, data)).catch(() => {}); } catch (_) {}
    }
    return response;
  };

  // Intercept XHR
  const OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OrigXHR();
    const origOpen = xhr.open.bind(xhr);
    let captureUrl = null;
    xhr.open = function (method, url, ...rest) {
      if (shouldCapture(url)) captureUrl = url;
      return origOpen(method, url, ...rest);
    };
    xhr.addEventListener('load', function () {
      if (captureUrl) {
        try { const data = JSON.parse(this.responseText); dispatchData(captureUrl, data); } catch (_) {}
      }
    });
    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  window.addEventListener('SCA_API_DATA', (e) => {
    chrome.runtime.sendMessage({ type: 'MARKET_DATA', url: e.detail.url, data: e.detail.data, ts: e.detail.ts }).catch(() => {});
  });

  console.log('[SCA] Interceptor active');
})();
