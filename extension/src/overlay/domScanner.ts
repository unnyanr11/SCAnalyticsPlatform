/**
 * domScanner.ts
 *
 * Watches the Sim Companies SPA DOM for market-row / product-card
 * elements and emits callbacks when new anchors appear or disappear.
 *
 * Strategy:
 *   1. Perform an initial scan of the document on load.
 *   2. Set up a MutationObserver on document.body for subtree changes.
 *   3. Throttle re-scans to max once per 500ms to avoid thrashing.
 *
 * The scanner is intentionally read-only; it never modifies the DOM.
 */

import { extractProductIdFromNode } from './pageDetector';

export interface ScanResult {
  anchor: Element;
  productId: number;
}

type OnFoundCallback = (results: ScanResult[]) => void;
type OnRemovedCallback = (productIds: number[]) => void;

// Sim Companies DOM selectors — these target game-rendered rows/cards
// without depending on internal class names that could change.
const ANCHOR_SELECTORS = [
  // Market listing rows
  '[data-id]',
  '[data-resource-id]',
  '[data-item-id]',
  // Fallback: any <tr> or card-like <div> containing a market link
  'tr:has(a[href*="/market/"])',
  'div[class*="card"]:has(a[href*="/market/"])',
  'div[class*="item"]:has(a[href*="/market/"])',
  'li:has(a[href*="/market/"])',
  // Production building rows
  'tr:has(a[href*="/encyclopedia/"])',
  'div[class*="building"]',
];

export class DomScanner {
  private readonly observer: MutationObserver;
  private readonly knownIds = new Set<number>();
  private pending = false;
  private throttleMs: number;

  constructor(
    private readonly onFound: OnFoundCallback,
    private readonly onRemoved: OnRemovedCallback,
    throttleMs = 500,
  ) {
    this.throttleMs = throttleMs;
    this.observer = new MutationObserver(() => this.scheduleRescan());
  }

  start(): void {
    this.scan();
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  stop(): void {
    this.observer.disconnect();
  }

  private scheduleRescan(): void {
    if (this.pending) return;
    this.pending = true;
    setTimeout(() => {
      this.pending = false;
      this.scan();
    }, this.throttleMs);
  }

  private scan(): void {
    const found = new Map<number, Element>();

    for (const sel of ANCHOR_SELECTORS) {
      let elements: NodeListOf<Element>;
      try {
        elements = document.querySelectorAll(sel);
      } catch {
        // :has() unsupported in very old Chromium builds — skip gracefully
        continue;
      }

      for (const el of elements) {
        // Skip elements that already have an overlay host injected
        if (el.querySelector('.sca-shadow-host')) continue;

        const pid = extractProductIdFromNode(el);
        if (pid > 0 && !found.has(pid)) {
          found.set(pid, el);
        }
      }
    }

    // New elements
    const newResults: ScanResult[] = [];
    for (const [pid, anchor] of found) {
      if (!this.knownIds.has(pid)) {
        this.knownIds.add(pid);
        newResults.push({ anchor, productId: pid });
      }
    }
    if (newResults.length) this.onFound(newResults);

    // Removed elements (product IDs no longer in DOM)
    const removed: number[] = [];
    for (const pid of this.knownIds) {
      if (!found.has(pid)) {
        this.knownIds.delete(pid);
        removed.push(pid);
      }
    }
    if (removed.length) this.onRemoved(removed);
  }
}
