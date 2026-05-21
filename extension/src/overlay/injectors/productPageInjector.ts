/**
 * Product / resource detail page overlay injector.
 *
 * On a product detail page Sim Companies shows the product header, price,
 * supply stats, and related market offers. This injector mounts a full
 * OverlayPanel beneath the product header area.
 *
 * NO automated actions are performed. Read-only analytics only.
 */
import { createRoot } from 'react-dom/client';
import React from 'react';
import { overlayStore } from '../overlayStore';
import { createShadowHost } from '../shadowHost';
import { OverlayPanel } from '../components/OverlayPanel';
import type { OverlayMetrics } from '../overlayTypes';

const INJECTED_ATTR = 'data-sca-product-panel';

/** Selectors tried in order to find the product header/info block. */
const HEADER_SELECTORS = [
  '[class*="resource-header"]',
  '[class*="product-header"]',
  '[class*="item-header"]',
  '[class*="resource-detail"]',
  '[class*="product-info"]',
  'h1[class*="resource"]',
  'h1[class*="product"]',
  'main h1',
];

function extractProductIdFromUrl(): number | null {
  const m = location.pathname.match(/\/(\d+)(?:\?|$|\/|#)/);
  return m ? parseInt(m[1], 10) : null;
}

function findHeaderAnchor(): Element | null {
  for (const sel of HEADER_SELECTORS) {
    const el = document.querySelector(sel);
    if (el && !el.hasAttribute(INJECTED_ATTR)) return el;
  }
  return null;
}

function injectProductPanel(productId: number): (() => void) | null {
  const anchor = findHeaderAnchor();
  if (!anchor) return null;
  anchor.setAttribute(INJECTED_ATTR, '1');

  const initial: OverlayMetrics = overlayStore.get(productId) ?? {
    productId,
    productName: document.querySelector('h1')?.textContent?.trim() ?? 'Product',
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

  const { mountPoint, destroy } = createShadowHost(anchor, 'afterend', `product-panel-${productId}`);

  const root = createRoot(mountPoint);
  root.render(
    React.createElement(OverlayPanel, {
      initial,
      subscribe: (fn) => overlayStore.subscribe(productId, fn),
    }),
  );

  return () => {
    root.unmount();
    destroy();
  };
}

export function initProductPageInjector(): () => void {
  const productId = extractProductIdFromUrl();
  if (!productId) return () => {};

  let cleanup: (() => void) | null = null;

  const tryInject = () => {
    if (cleanup) return; // already injected
    cleanup = injectProductPanel(productId);
  };

  tryInject();

  // If the header isn't in the DOM yet (SPA lazy render), wait for it
  if (!cleanup) {
    const observer = new MutationObserver(() => {
      tryInject();
      if (cleanup) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cleanup?.();
    };
  }

  return () => cleanup?.();
}
