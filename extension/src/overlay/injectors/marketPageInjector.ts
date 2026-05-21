/**
 * Market page overlay injector.
 *
 * Sim Companies market pages display products in list/table rows.
 * This injector watches for market rows appearing in the DOM and
 * injects a compact OverlayBadge into each row using Shadow DOM isolation.
 *
 * NO automated actions are performed. Read-only analytics only.
 */
import { createRoot } from 'react-dom/client';
import React from 'react';
import { overlayStore } from '../overlayStore';
import { getOrCreateShadowHost } from '../shadowHost';
import { OverlayBadge } from '../components/OverlayBadge';
import type { OverlayMetrics } from '../overlayTypes';

const INJECTED_ATTR = 'data-sca-market-badge';

/** Selector patterns for Sim Companies market row elements. */
const ROW_SELECTORS = [
  '[class*="market-item"]',
  '[class*="market-row"]',
  '[class*="resource-row"]',
  '[class*="item-row"]',
  'tr[data-item-id]',
  'tr[data-resource-id]',
  // Fallback: any table row with a price-looking child
  'table tbody tr',
];

function extractProductId(el: Element): number | null {
  const candidates = [
    el.getAttribute('data-item-id'),
    el.getAttribute('data-resource-id'),
    el.getAttribute('data-product-id'),
    // URL patterns in links within the row
    ...Array.from(el.querySelectorAll('a[href]')).map((a) => {
      const m = a.getAttribute('href')?.match(/\/(\d+)(?:\?|$|\/|#)/);
      return m?.[1] ?? null;
    }),
  ].filter(Boolean);

  for (const c of candidates) {
    const n = parseInt(String(c), 10);
    if (n > 0 && n < 99999) return n;
  }
  return null;
}

function injectRowBadge(row: Element): void {
  if (row.hasAttribute(INJECTED_ATTR)) return;
  row.setAttribute(INJECTED_ATTR, '1');

  const productId = extractProductId(row);

  // Find the best anchor cell (last td, or a price cell)
  const cells = row.querySelectorAll('td');
  const anchor: Element = cells[cells.length - 1] ?? row;

  // Build placeholder metrics if we don't have real data yet
  const initial: OverlayMetrics = overlayStore.get(productId ?? -1) ?? {
    productId: productId ?? 0,
    productName: row.querySelector('[class*="name"]')?.textContent?.trim() ?? 'Product',
    profitabilityScore: 0,
    aiConfidence: 0,
    volatility: 0,
    shortageRisk: 0,
    oversatRisk: 0,
    marketDirection: 'neutral',
    signal: 'hold',
    expectedMarginPct: 0,
    updatedAt: Date.now(),
  };

  const { mountPoint } = getOrCreateShadowHost(
    anchor,
    `market-badge-${productId ?? 'unknown'}`,
    'beforeend',
  );

  const subscribe = productId
    ? (fn: (m: OverlayMetrics) => void) => overlayStore.subscribe(productId, fn)
    : (fn: (m: OverlayMetrics) => void) => overlayStore.subscribeAll(fn);

  createRoot(mountPoint).render(
    React.createElement(OverlayBadge, { initial, subscribe, compact: true }),
  );
}

export function initMarketPageInjector(): () => void {
  const observed = new Set<Element>();

  const tryInjectAll = () => {
    for (const sel of ROW_SELECTORS) {
      document.querySelectorAll(sel).forEach((row) => {
        if (!observed.has(row)) {
          observed.add(row);
          injectRowBadge(row);
        }
      });
    }
  };

  tryInjectAll();

  const observer = new MutationObserver((mutations) => {
    let dirty = false;
    for (const m of mutations) {
      if (m.addedNodes.length) { dirty = true; break; }
    }
    if (dirty) tryInjectAll();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return () => observer.disconnect();
}
