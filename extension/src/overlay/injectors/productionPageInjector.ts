/**
 * Production page overlay injector.
 *
 * On production pages Sim Companies shows factory cards with the product
 * being manufactured. This injector watches for factory / production cards
 * and injects an OverlayBadge into each one.
 *
 * Also watches for the "Add production" modal to inject an OverlayPanel
 * when the player is choosing what to produce.
 *
 * NO automated actions are performed. Read-only analytics only.
 */
import { createRoot } from 'react-dom/client';
import React from 'react';
import { overlayStore } from '../overlayStore';
import { getOrCreateShadowHost, createShadowHost } from '../shadowHost';
import { OverlayBadge } from '../components/OverlayBadge';
import { OverlayPanel } from '../components/OverlayPanel';
import type { OverlayMetrics } from '../overlayTypes';

const BADGE_ATTR   = 'data-sca-prod-badge';
const MODAL_ATTR   = 'data-sca-prod-modal';

const CARD_SELECTORS = [
  '[class*="production-card"]',
  '[class*="factory-card"]',
  '[class*="production-item"]',
  '[class*="building-card"]',
  '[class*="produce-item"]',
];

const MODAL_SELECTORS = [
  '[class*="production-modal"]',
  '[class*="add-production"]',
  '[class*="select-product-modal"]',
  '[role="dialog"]',
];

function extractProductIdFromCard(card: Element): number | null {
  const candidates = [
    card.getAttribute('data-item-id'),
    card.getAttribute('data-resource-id'),
    card.getAttribute('data-product-id'),
    ...Array.from(card.querySelectorAll('a[href],img[src]')).map((el) => {
      const attr = el.getAttribute('href') ?? el.getAttribute('src') ?? '';
      const m = attr.match(/\/(\d+)(?:\?|$|\/|#)/);
      return m?.[1] ?? null;
    }),
  ].filter(Boolean);

  for (const c of candidates) {
    const n = parseInt(String(c), 10);
    if (n > 0 && n < 99999) return n;
  }
  return null;
}

function injectCardBadge(card: Element): void {
  if (card.hasAttribute(BADGE_ATTR)) return;
  card.setAttribute(BADGE_ATTR, '1');

  const productId = extractProductIdFromCard(card);
  const nameEl = card.querySelector('[class*="name"],[class*="title"],h3,h4');

  const initial: OverlayMetrics = overlayStore.get(productId ?? -1) ?? {
    productId: productId ?? 0,
    productName: nameEl?.textContent?.trim() ?? 'Product',
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

  const anchor = nameEl ?? card;
  const { mountPoint } = getOrCreateShadowHost(
    anchor,
    `prod-badge-${productId ?? 'x'}`,
    'afterend',
  );

  const subscribe = productId
    ? (fn: (m: OverlayMetrics) => void) => overlayStore.subscribe(productId, fn)
    : (fn: (m: OverlayMetrics) => void) => overlayStore.subscribeAll(fn);

  createRoot(mountPoint).render(
    React.createElement(OverlayBadge, { initial, subscribe, compact: false }),
  );
}

function injectModalPanel(modal: Element): void {
  if (modal.hasAttribute(MODAL_ATTR)) return;
  modal.setAttribute(MODAL_ATTR, '1');

  // Look for a resource/product selector inside the modal
  const selector = modal.querySelector('[class*="resource-select"],[class*="product-select"],select');
  if (!selector) return;

  const productId = (
    parseInt((
      modal.getAttribute('data-item-id') ??
      modal.getAttribute('data-resource-id') ?? '0'
    ), 10)
  ) || null;

  if (!productId) return;

  const initial: OverlayMetrics = overlayStore.get(productId) ?? {
    productId,
    productName: 'Selected product',
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

  const { mountPoint } = createShadowHost(selector, 'afterend', `modal-panel-${productId}`);
  createRoot(mountPoint).render(
    React.createElement(OverlayPanel, {
      initial,
      subscribe: (fn) => overlayStore.subscribe(productId, fn),
    }),
  );
}

export function initProductionPageInjector(): () => void {
  const tryInjectCards = () => {
    for (const sel of CARD_SELECTORS) {
      document.querySelectorAll(sel).forEach(injectCardBadge);
    }
  };

  const tryInjectModals = () => {
    for (const sel of MODAL_SELECTORS) {
      document.querySelectorAll(sel).forEach(injectModalPanel);
    }
  };

  tryInjectCards();
  tryInjectModals();

  const observer = new MutationObserver((mutations) => {
    let dirty = false;
    for (const m of mutations) {
      if (m.addedNodes.length) { dirty = true; break; }
    }
    if (dirty) { tryInjectCards(); tryInjectModals(); }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
