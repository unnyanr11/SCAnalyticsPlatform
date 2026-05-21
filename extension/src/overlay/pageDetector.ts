/**
 * pageDetector.ts
 *
 * Determines which type of Sim Companies page the user is on,
 * and extracts contextual product IDs from the URL / DOM.
 *
 * URL patterns observed in-game:
 *   /market                           → market (listing)
 *   /market/{id}                      → product (market detail)
 *   /company/buildings/building/{id}  → production
 *   /company/inventory                → production (inventory view)
 *   /encyclopedia/{id}                → product (encyclopedia)
 */

import type { PageKind } from './types';

export interface PageContext {
  kind: PageKind;
  /** Product ID extracted from URL (0 if not applicable) */
  productId: number;
  /** Full pathname for reference */
  pathname: string;
}

const PATTERNS: { re: RegExp; kind: PageKind }[] = [
  { re: /\/market\/?(\d+)/,                       kind: 'product'    },
  { re: /\/encyclopedia\/(\d+)/,                   kind: 'product'    },
  { re: /\/market\/?$/,                             kind: 'market'     },
  { re: /\/company\/buildings\/building\/(\d+)/,   kind: 'production' },
  { re: /\/company\/inventory/,                    kind: 'production' },
  { re: /\/company\/buildings/,                    kind: 'production' },
];

export function detectPage(pathname = location.pathname): PageContext {
  for (const { re, kind } of PATTERNS) {
    const m = pathname.match(re);
    if (m) {
      return {
        kind,
        productId: m[1] ? parseInt(m[1], 10) : 0,
        pathname,
      };
    }
  }
  return { kind: 'unknown', productId: 0, pathname };
}

/**
 * Extract the numeric product ID from a DOM node that the game
 * renders for each market row / card.
 *
 * Sim Companies typically encodes the resource id in:
 *   - data-id, data-resource-id, data-item-id attributes
 *   - A child <a> whose href includes /market/{id}
 *   - A data-bind or ng-bind attribute containing the id
 */
export function extractProductIdFromNode(el: Element): number {
  // Direct data attributes
  for (const attr of ['data-id', 'data-resource-id', 'data-item-id', 'data-product-id']) {
    const v = el.getAttribute(attr) ?? el.closest(`[${attr}]`)?.getAttribute(attr);
    if (v) {
      const n = parseInt(v, 10);
      if (n > 0) return n;
    }
  }

  // Scan child links for /market/{id} or /encyclopedia/{id}
  const links = el.querySelectorAll<HTMLAnchorElement>('a[href]');
  for (const a of links) {
    const m =
      a.getAttribute('href')?.match(/\/market\/(\d+)/) ??
      a.getAttribute('href')?.match(/\/encyclopedia\/(\d+)/);
    if (m?.[1]) return parseInt(m[1], 10);
  }

  // As a last resort scan text for a standalone integer that looks like an id
  const text = el.textContent ?? '';
  const m = text.match(/\b(\d{1,4})\b/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 9999) return n;
  }

  return 0;
}
