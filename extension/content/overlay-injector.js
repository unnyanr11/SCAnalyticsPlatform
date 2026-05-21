// SC Analytics Platform — Overlay Injector
// Injects read-only analytics badges into game pages. No clicks, no actions.

(function () {
  'use strict';

  let overlayEnabled = true;

  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
    if (res && res.settings) overlayEnabled = res.settings.overlayEnabled;
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TOGGLE_OVERLAY') overlayEnabled = msg.enabled;
  });

  window.addEventListener('SCA_OVERLAY_UPDATE', (e) => {
    if (!overlayEnabled) return;
    injectBadge(e.detail);
  });

  function injectBadge({ elementId, label, color }) {
    const el = document.querySelector('[data-sca-id="' + elementId + '"]');
    if (!el) return;
    let badge = el.querySelector('.sca-badge');
    if (!badge) { badge = document.createElement('span'); badge.className = 'sca-badge'; el.appendChild(badge); }
    badge.textContent = label;
    badge.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44;margin-left:8px;vertical-align:middle;white-space:nowrap;';
  }

  function tagMarketRows() {
    document.querySelectorAll('[class*="market-row"],[class*="MarketRow"],tr[data-id]').forEach((row) => {
      if (!row.dataset.scaId) {
        row.dataset.scaId = row.dataset.id || (row.querySelector('[data-id]') && row.querySelector('[data-id]').dataset.id) || Math.random().toString(36).slice(2);
      }
    });
  }

  const observer = new MutationObserver(tagMarketRows);
  observer.observe(document.body, { childList: true, subtree: true });
  tagMarketRows();
  console.log('[SCA] Overlay injector active');
})();
