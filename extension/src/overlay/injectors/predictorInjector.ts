/**
 * predictorInjector — mounts PredictorPanel into Shadow DOM.
 *
 * Called from contentBridge.ts alongside the existing page injectors.
 * Detects page type, finds the best anchor, and renders the panel once.
 *
 * STRICTLY ANALYTICS ONLY. Zero automated game actions.
 */
import { createRoot } from 'react-dom/client';
import React from 'react';
import { createShadowHost } from '../shadowHost';
import type { PageContext } from '../overlayTypes';
import { PredictorPanel } from '../components/PredictorPanel';
import type { EconomyPhase } from '../../services/predictorClient';

const INJECTED_ATTR = 'data-sca-predictor';

// Selectors tried in order to find anchor for the predictor panel
const ANCHORS_BY_TYPE: Record<string, string[]> = {
  product: [
    '[class*="resource-header"]',
    '[class*="product-header"]',
    '[class*="item-detail"]',
    'main h1',
  ],
  market: [
    '[class*="market-header"]',
    '[class*="exchange-header"]',
    'main h1',
    'main h2',
  ],
  production: [
    '[class*="production-header"]',
    '[class*="factory-header"]',
    'main h1',
  ],
};

function findAnchor(type: string): Element | null {
  const sels = ANCHORS_BY_TYPE[type] ?? [];
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (el && !el.hasAttribute(INJECTED_ATTR)) return el;
  }
  return null;
}

export function initPredictorInjector(ctx: PageContext): () => void {
  if (ctx.type === 'unknown') return () => {};

  const inject = () => {
    const anchor = findAnchor(ctx.type);
    if (!anchor) return false;
    anchor.setAttribute(INJECTED_ATTR, '1');

    const productId = ctx.productId ?? extractIdFromUrl();
    if (!productId) return false;

    // Detect economy phase from page meta or default to stable
    const economyPhase = detectEconomyPhase();

    const { mountPoint, destroy } = createShadowHost(
      anchor,
      'afterend',
      `predictor-panel-${productId}`,
    );

    const root = createRoot(mountPoint);
    root.render(
      React.createElement(PredictorPanel, {
        productId,
        productName: extractProductName(),
        economyPhase,
        autoRefresh: true,
        horizonHours: 24,
      }),
    );

    return true;
  };

  if (inject()) return () => {};

  // Wait for anchor with MutationObserver
  const observer = new MutationObserver(() => {
    if (inject()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function extractIdFromUrl(): number | null {
  const m = location.pathname.match(/\/(\d+)(?:\?|$|\/|#)/);
  return m ? parseInt(m[1], 10) : null;
}

function extractProductName(): string {
  return (
    document.querySelector('h1')?.textContent?.trim() ??
    document.title.split(' - ')[0] ??
    'Product'
  );
}

function detectEconomyPhase(): EconomyPhase {
  // Try to read phase from DOM text injected by Sim Companies
  const text = document.body.innerText.toLowerCase();
  if (text.includes('recession')) return 'recession';
  if (text.includes('boom'))      return 'boom';
  if (text.includes('recovery'))  return 'recovery';
  return 'stable';
}
