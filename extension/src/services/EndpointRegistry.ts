/**
 * SC Analytics Platform — Endpoint Registry
 *
 * Centralised catalogue of all supported API endpoints.
 * Provides URL pattern matching, endpoint metadata, fallback providers,
 * and schema change compatibility warnings.
 *
 * The registry is the single source of truth for:
 *   • Which URLs should be intercepted
 *   • What kind of data each URL returns
 *   • TTL for caching each response
 *   • Fallback URL when a primary endpoint is unavailable
 *   • Whether an endpoint requires authentication (read-only scope)
 */

import type { EndpointKind } from './ResponseParser';

export interface EndpointDescriptor {
  id:              string;
  kind:            EndpointKind;
  pattern:         RegExp;
  cacheTtlMs:      number;     // 0 = do not cache
  priority:        number;     // higher = preferred when multiple match
  requiresAuth:    boolean;    // true = only works when user is logged in
  fallback?:       string;     // static fallback URL (no dynamic segments)
  notes?:          string;
}

const REGISTRY: EndpointDescriptor[] = [
  // -------------------------------------------------------------------------
  // Sim Companies — primary
  // -------------------------------------------------------------------------
  {
    id:           'sc_market_v2',
    kind:         'market_offers',
    pattern:      /https?:\/\/(?:www\.)?simcompanies\.com\/api\/v2\/market\/\d+/,
    cacheTtlMs:   60_000,       // 1 minute — market data is volatile
    priority:     100,
    requiresAuth: false,
    notes:        'GET /api/v2/market/{itemId}?realm={0|1} — returns offer array',
  },
  {
    id:           'sc_encyclopedia',
    kind:         'encyclopedia',
    pattern:      /https?:\/\/(?:www\.)?simcompanies\.com\/api\/v4\/pt\/\d+\/encyclopedia/,
    cacheTtlMs:   24 * 60 * 60_000, // 24h — resource definitions rarely change
    priority:     90,
    requiresAuth: false,
    notes:        'GET /api/v4/pt/{realm}/encyclopedia/resources/',
  },
  {
    id:           'sc_retail_info',
    kind:         'retail_info',
    pattern:      /https?:\/\/(?:www\.)?simcompanies\.com\/api\/v4\/\d+\/resources-retail-info/,
    cacheTtlMs:   5 * 60_000,   // 5 minutes
    priority:     85,
    requiresAuth: false,
    notes:        'GET /api/v4/{realm}/resources-retail-info/',
  },

  // -------------------------------------------------------------------------
  // SimcoTools — supplementary analytics
  // -------------------------------------------------------------------------
  {
    id:           'simcotools_resources',
    kind:         'simcotools_resources',
    pattern:      /https?:\/\/simcotools\.app\/api\/v3\/resources/,
    cacheTtlMs:   6 * 60 * 60_000, // 6h
    priority:     70,
    requiresAuth: false,
    fallback:     'https://simcotools.app/api/v3/resources',
    notes:        'SimcoTools resource catalogue',
  },
  {
    id:           'simcotools_phase',
    kind:         'simcotools_phase',
    pattern:      /https?:\/\/api\.simcotools\.com\/v1\/realms\/\d+\/phases/,
    cacheTtlMs:   15 * 60_000,  // 15 minutes
    priority:     80,
    requiresAuth: false,
    fallback:     'https://api.simcotools.com/v1/realms/0/phases',
    notes:        'Economy phase — boom | stable | recession | recovery',
  },
];

export class EndpointRegistry {
  private descriptors: EndpointDescriptor[];

  constructor(descriptors: EndpointDescriptor[] = REGISTRY) {
    // Sort by priority descending so first match is the best match
    this.descriptors = [...descriptors].sort((a, b) => b.priority - a.priority);
  }

  /** Find the best-matching descriptor for a URL, or null if not monitored. */
  match(url: string): EndpointDescriptor | null {
    for (const desc of this.descriptors) {
      if (desc.pattern.test(url)) return desc;
    }
    return null;
  }

  /** True if this URL should be intercepted / monitored. */
  shouldIntercept(url: string): boolean {
    return this.match(url) !== null;
  }

  /** TTL in ms for a given URL (0 = don’t cache). */
  ttlFor(url: string): number {
    return this.match(url)?.cacheTtlMs ?? 0;
  }

  /** All descriptors (read-only snapshot). */
  all(): ReadonlyArray<EndpointDescriptor> {
    return this.descriptors;
  }

  /**
   * Register a custom endpoint at runtime.
   * Used when the game updates its API and a community patch is needed
   * before an extension update ships.
   */
  register(descriptor: EndpointDescriptor): void {
    // Replace if same id exists
    const idx = this.descriptors.findIndex((d) => d.id === descriptor.id);
    if (idx >= 0) {
      this.descriptors[idx] = descriptor;
    } else {
      this.descriptors.push(descriptor);
      this.descriptors.sort((a, b) => b.priority - a.priority);
    }
  }

  /** Remove a descriptor by id. */
  unregister(id: string): void {
    this.descriptors = this.descriptors.filter((d) => d.id !== id);
  }
}

export const endpointRegistry = new EndpointRegistry();
