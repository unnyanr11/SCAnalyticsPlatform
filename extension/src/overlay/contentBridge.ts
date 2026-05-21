/**
 * contentBridge.ts — Entry point called by content.ts.
 *
 * Responsibilities:
 *  1. Detect the current page type from the URL / DOM.
 *  2. Launch the appropriate page injector(s).
 *  3. Listen for MARKET_DATA_INTERCEPTED messages from the fetch interceptor
 *     and update overlayStore with derived metrics.
 *  4. Teardown injectors on SPA navigation.
 *
 * STRICTLY ANALYTICS ONLY. Zero automated game actions.
 */

import { overlayStore } from './overlayStore';
import { deriveMetrics } from './overlayUtils';
import type { PageContext, PageType } from './overlayTypes';

// Lazy-loaded injectors (only the relevant one is ever imported)
let cleanupFns: Array<() => void> = [];

// ─── Page type detection ──────────────────────────────────────────────

function detectPageType(pathname: string): PageContext {
  const ctx: PageContext = { type: 'unknown', pathname };

  // Market pages: /market, /market/*, /exchange, /exchange/*
  if (/\/(market|exchange)(\?|\/|$)/.test(pathname)) {
    ctx.type = 'market';
    return ctx;
  }

  // Production pages: /production, /factory, /factories, /buildings
  if (/\/(production|factory|factories|buildings)(\?|\/|$)/.test(pathname)) {
    ctx.type = 'production';
    return ctx;
  }

  // Product detail pages: /encyclopedia/*, /resources/*, /market/<id>
  if (/\/(encyclopedia|resources|market)\/\d+/.test(pathname)) {
    ctx.type = 'product';
    const m = pathname.match(/\/(\d+)(?:\?|$)/);
    if (m) ctx.productId = parseInt(m[1], 10);
    return ctx;
  }

  // Anything with a numeric segment may be a product detail
  const numMatch = pathname.match(/\/(\d+)(?:\?|$|\/|#)/);
  if (numMatch) {
    ctx.type = 'product';
    ctx.productId = parseInt(numMatch[1], 10);
  }

  return ctx;
}

// ─── Injector launch ───────────────────────────────────────────────

async function launchInjectors(type: PageType) {
  teardownInjectors();

  if (type === 'market') {
    const { initMarketPageInjector } = await import('./injectors/marketPageInjector');
    cleanupFns.push(initMarketPageInjector());
  }

  if (type === 'product') {
    const { initProductPageInjector } = await import('./injectors/productPageInjector');
    cleanupFns.push(initProductPageInjector());
  }

  if (type === 'production') {
    const { initProductionPageInjector } = await import('./injectors/productionPageInjector');
    cleanupFns.push(initProductionPageInjector());
    // Also launch market injector for any market rows on the same page
    const { initMarketPageInjector } = await import('./injectors/marketPageInjector');
    cleanupFns.push(initMarketPageInjector());
  }
}

function teardownInjectors() {
  cleanupFns.forEach((fn) => fn());
  cleanupFns = [];
}

// ─── Message listener (from fetch interceptor) ────────────────────────

type InterceptMessage = {
  type: 'MARKET_DATA_INTERCEPTED';
  url: string;
  data: unknown;
  timestamp: number;
};

function handleInterceptedData(msg: InterceptMessage) {
  const { url, data } = msg;

  // Single product endpoint: /api/v2/market/{id} or /api/v4/.../resources/{id}
  const singleMatch = url.match(/\/(\d+)(?:\?|$)/);
  if (singleMatch && data && typeof data === 'object') {
    const productId = parseInt(singleMatch[1], 10);
    if (productId > 0 && productId < 99999) {
      const payload = data as Record<string, unknown>;
      const name = String(
        payload.name ?? payload.resourceName ?? payload.label ?? 'Product',
      );
      overlayStore.set(deriveMetrics(productId, name, payload));
    }
    return;
  }

  // Array endpoint: SimcoTools /api/v3/resources or similar
  if (Array.isArray(data)) {
    (data as Record<string, unknown>[]).forEach((item) => {
      const id = parseInt(String(item.id ?? item.resourceId ?? item.itemId ?? '0'), 10);
      if (id > 0 && id < 99999) {
        const name = String(item.name ?? item.label ?? 'Product');
        overlayStore.set(deriveMetrics(id, name, item));
      }
    });
  }
}

// ─── SPA navigation detection ───────────────────────────────────────

function patchHistory() {
  const wrap = (orig: History['pushState']) =>
    function (this: History, ...args: Parameters<History['pushState']>) {
      orig.apply(this, args);
      window.dispatchEvent(new Event('sca:navigate'));
    };

  history.pushState    = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);
  window.addEventListener('popstate', () =>
    window.dispatchEvent(new Event('sca:navigate')),
  );
}

// ─── Public init ───────────────────────────────────────────────────

export function initOverlaySystem(): void {
  // 1. Patch history for SPA nav detection
  patchHistory();

  // 2. Listen for intercepted market data messages
  chrome.runtime.onMessage.addListener((msg: unknown) => {
    if (
      msg &&
      typeof msg === 'object' &&
      (msg as { type?: string }).type === 'MARKET_DATA_INTERCEPTED'
    ) {
      handleInterceptedData(msg as InterceptMessage);
    }
  });

  // 3. Launch injectors for the current page
  const { type } = detectPageType(location.pathname);
  void launchInjectors(type);

  // 4. Re-launch on SPA navigation
  window.addEventListener('sca:navigate', () => {
    const next = detectPageType(location.pathname);
    void launchInjectors(next.type);
  });
}
