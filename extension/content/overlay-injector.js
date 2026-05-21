/**
 * overlay-injector.js
 * SC Analytics Platform — Feature 1: Live Market Intelligence Overlay
 *
 * Injects read-only analytics badges and overlay panels into SimCompanies
 * market pages. Strictly observational — no clicks, no automated actions.
 *
 * Badge types injected:
 *  - Price direction arrow
 *  - Profitability score
 *  - Demand trend
 *  - Volatility score
 *  - Shortage probability
 *  - Oversaturation risk
 *  - AI confidence score
 *  - Label (e.g. "Strong Buy", "Oversaturated")
 */

(function () {
  'use strict';

  // ─── Settings ────────────────────────────────────────────────────────────────
  let overlayEnabled = true;
  let itemRegistry = new Map(); // itemId → ScoredItem

  try {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
      if (res?.settings) overlayEnabled = res.settings.overlayEnabled ?? true;
    });
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'TOGGLE_OVERLAY') overlayEnabled = msg.enabled;
    });
  } catch (_) {}

  // ─── Color palette for badge types ────────────────────────────────────────────
  const TYPE_COLORS = {
    bullish:  '#22c55e',
    bearish:  '#ef4444',
    warning:  '#f59e0b',
    danger:   '#ef4444',
    volatile: '#a855f7',
    neutral:  '#64748b',
  };

  // ─── Throttle util ──────────────────────────────────────────────────────────────
  function throttle(fn, ms) {
    let last = 0;
    return function (...args) {
      const now = Date.now();
      if (now - last >= ms) { last = now; fn(...args); }
    };
  }

  // ─── Badge HTML builder ──────────────────────────────────────────────────────

  function buildBadge(scored) {
    const { label, scores } = scored;
    const color = TYPE_COLORS[label.type] || TYPE_COLORS.neutral;
    const badge = document.createElement('span');
    badge.className = 'sca-overlay-badge';
    badge.setAttribute('data-sca-item-id', scored.id);
    badge.setAttribute('title',
      `Profitability: ${scores.profitability}% | Volatility: ${scores.volatility} | Confidence: ${scores.confidence}%\n` +
      `Shortage: ${scores.shortage}% | Oversaturation: ${scores.oversaturation}%\n` +
      `Demand: ${scores.demandTrend} | Price: ${scores.priceDirection}`
    );

    badge.innerHTML = `
      <span class="sca-badge-icon">${label.icon}</span>
      <span class="sca-badge-text">${label.text}</span>
      <span class="sca-badge-meta">${scores.profitability}% | conf ${scores.confidence}%</span>
    `;

    badge.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:5px',
      'padding:3px 10px',
      'border-radius:999px',
      'font-size:11px',
      'font-weight:600',
      'font-family:system-ui,sans-serif',
      `background:${color}18`,
      `color:${color}`,
      `border:1px solid ${color}44`,
      'margin-left:8px',
      'vertical-align:middle',
      'white-space:nowrap',
      'cursor:default',
      'pointer-events:auto',
      'z-index:9999',
      'line-height:1.4',
    ].join(';');

    badge.querySelector('.sca-badge-meta').style.cssText =
      'font-size:10px;opacity:0.7;font-weight:400;';

    return badge;
  }

  // ─── DOM targeting ──────────────────────────────────────────────────────────────

  /**
   * Attempts to find a DOM element representing the given item.
   * Checks data attributes, item name text, and href patterns.
   */
  function findItemElements(scored) {
    const selectors = [
      `[data-resource="${scored.id}"]`,
      `[data-kind="${scored.id}"]`,
      `[data-item-id="${scored.id}"]`,
      `[data-id="${scored.id}"]`,
      `[href*="/encyclopedia/${scored.id}"]`,
      `[href*="/market/${scored.id}"]`,
    ];

    const found = [];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        if (!found.includes(el)) found.push(el);
      });
    }

    // Fallback: text search on item name in market rows
    if (!found.length && scored.name && scored.name !== 'Unknown') {
      const rows = document.querySelectorAll(
        'tr, [class*="row"], [class*="Row"], [class*="item"], [class*="Item"]'
      );
      rows.forEach((row) => {
        if (
          row.textContent.includes(scored.name) &&
          !row.querySelector('.sca-overlay-badge')
        ) {
          found.push(row);
        }
      });
    }

    return found;
  }

  // ─── Inject badge into element ────────────────────────────────────────────────

  function injectBadgeIntoElement(el, scored) {
    // Remove any existing badge for this item
    el.querySelectorAll('.sca-overlay-badge').forEach((b) => b.remove());
    const badge = buildBadge(scored);
    // Find the best insertion point: after a price element or append to row
    const priceEl = el.querySelector(
      '[class*="price"],[class*="Price"],[data-price],td:nth-child(2)'
    );
    if (priceEl) {
      priceEl.appendChild(badge);
    } else {
      el.appendChild(badge);
    }
  }

  function injectScoredItem(scored) {
    if (!overlayEnabled) return;
    const elements = findItemElements(scored);
    elements.forEach((el) => injectBadgeIntoElement(el, scored));
  }

  // ─── Refresh all visible badges ───────────────────────────────────────────────

  const refreshOverlays = throttle(() => {
    if (!overlayEnabled) {
      document.querySelectorAll('.sca-overlay-badge').forEach((b) => b.remove());
      return;
    }
    itemRegistry.forEach((scored) => injectScoredItem(scored));
  }, 2000);

  // ─── Listen for scored items from scorer.js ──────────────────────────────────

  window.addEventListener('SCA_SCORED_ITEMS', (event) => {
    const { items } = event.detail;
    items.forEach((scored) => {
      if (scored.id) itemRegistry.set(scored.id, scored);
    });
    refreshOverlays();
  });

  // ─── MutationObserver: re-inject when DOM changes (SPA navigation) ──────────

  const observer = new MutationObserver(throttle(() => {
    refreshOverlays();
  }, 1500));

  observer.observe(document.body, { childList: true, subtree: true });

  console.debug('[SCA] Overlay injector active.');
})();
