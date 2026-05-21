/**
 * contentBridge.ts
 *
 * Bridges the existing content.ts fetch interceptor with the
 * OverlayManager.
 *
 * Flow:
 *   Fetch intercepted by content.ts
 *     → MARKET_DATA_INTERCEPTED message sent to background
 *     → Background normalises → builds OverlayMetrics via scoreEngine
 *     → Sends SCA_OVERLAY_UPDATE back to content script tab
 *     → overlayManager.updateMetrics() called
 *     → React re-renders badge/panel with fresh data
 *
 * This file also handles direct same-context metric updates for when
 * the background pipeline is bypassed during development / testing.
 */

import { OverlayManager } from './overlayManager';
import { buildOverlayMetrics } from './scoreEngine';
import type { OverlayMetrics } from './types';

let manager: OverlayManager | null = null;

export function initOverlaySystem(): void {
  if (manager) return; // Already initialised (hot-reload guard)

  manager = new OverlayManager();
  manager.start();

  // Optional: patch fetch directly in content context to score inline
  // (supplements background pipeline; useful when SW is not yet running)
  patchFetchForInlineScoring();
}

export function destroyOverlaySystem(): void {
  manager?.stop();
  manager = null;
}

// Called by background → content message (SCA_OVERLAY_UPDATE) —
// the overlayManager's own listener handles this automatically.
// This export is available for direct calls from tests / devtools.
export function pushMetrics(metrics: OverlayMetrics): void {
  manager?.updateMetrics(metrics);
}

// ── Inline fetch scoring ──────────────────────────────────────────────

function patchFetchForInlineScoring(): void {
  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await original(input, init);
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : (input as Request).url;

    if (isMarketEndpoint(url)) {
      response.clone().json().then((data: unknown) => {
        scoreAndPush(data, url);
      }).catch(() => { /* non-JSON, skip */ });
    }

    return response;
  };
}

function isMarketEndpoint(url: string): boolean {
  return (
    url.includes('simcompanies.com/api') ||
    url.includes('simcotools.app/api') ||
    url.includes('api.simcotools.com')
  );
}

function scoreAndPush(data: unknown, url: string): void {
  if (!data || typeof data !== 'object') return;
  if (!manager) return;

  const items: unknown[] = Array.isArray(data) ? data : [data];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;

    const productId = Number(
      raw['product_id'] ?? raw['resourceId'] ?? raw['itemId'] ?? raw['id'] ?? 0,
    );
    if (!productId) continue;

    // Remap snake_case API keys to camelCase for scoreEngine
    const mapped = {
      productId,
      name:            String(raw['name'] ?? raw['resource_name'] ?? `Product #${productId}`),
      vwap:            Number(raw['vwap'] ?? raw['price'] ?? raw['lowest_ask'] ?? 0),
      lowestAsk:       Number(raw['lowest_ask'] ?? 0),
      highestAsk:      Number(raw['highest_ask'] ?? 0),
      totalSupply:     Number(raw['total_supply'] ?? raw['quantity'] ?? 0),
      demandScore:     Number(raw['demand_score'] ?? raw['demand'] ?? 0.5),
      priceVolatility: Number(raw['price_volatility'] ?? raw['volatility'] ?? 0.1),
      momentum24h:     Number(raw['momentum_24h'] ?? raw['momentum24h'] ?? 0),
      price24hAgo:     Number(raw['price_24h_ago'] ?? 0),
      shortageRisk:    Number(raw['shortage_risk'] ?? 0),
      aiConfidence:    Number(raw['ai_confidence'] ?? raw['confidence'] ?? 0.5),
    };

    const metrics = buildOverlayMetrics(mapped, mapped.name);
    manager.updateMetrics(metrics);
  }
}
