/**
 * SC Analytics Platform — Overlay Injector
 *
 * Creates a React-free, lightweight overlay layer injected directly into
 * the Sim Companies DOM. Uses vanilla DOM operations for maximum performance
 * and minimal footprint.
 *
 * The full React popup is separate (popup/). Overlays are intentionally
 * minimal — small badges that display AI signals next to market items.
 *
 * Overlay lifecycle:
 *   mount()   — inject root container and observe market item containers
 *   unmount() — remove all overlay elements cleanly
 *   updateSignal() — update or create a badge for a resource
 */

import { OVERLAY_ROOT_ID, OVERLAY_STYLE_ID } from '../utils/constants';
import type { OverlayUpdatePayload } from '../types/messages';
import { formatPct, formatScore }    from '../utils/format';
import { log }                       from '../utils/logger';

const SIGNAL_COLORS: Record<string, string> = {
  bullish: '#22c55e',
  bearish: '#ef4444',
  warning: '#f59e0b',
  neutral: '#94a3b8',
};

const SIGNAL_ICONS: Record<string, string> = {
  bullish: '📈',
  bearish: '📉',
  warning: '⚠️',
  neutral: '—',
};

export class OverlayInjector {
  private root: HTMLElement | null = null;
  private badges = new Map<number, HTMLElement>();
  private observer: MutationObserver | null = null;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  mount(): void {
    if (document.getElementById(OVERLAY_ROOT_ID)) return;

    this.injectStyles();
    this.root = document.createElement('div');
    this.root.id = OVERLAY_ROOT_ID;
    document.body.appendChild(this.root);

    this.attachDOMObserver();
    log.info('[Overlay] Mounted');
  }

  unmount(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.badges.clear();
    this.root?.remove();
    this.root = null;
    document.getElementById(OVERLAY_STYLE_ID)?.remove();
    log.info('[Overlay] Unmounted');
  }

  // -------------------------------------------------------------------------
  // Signal Update
  // -------------------------------------------------------------------------

  updateSignal(payload: OverlayUpdatePayload): void {
    const { itemId, signal, label, confidenceScore, profitabilityPct } = payload;

    let badge = this.badges.get(itemId);
    if (!badge) {
      badge = this.createBadge(itemId);
      this.badges.set(itemId, badge);
    }

    const color = SIGNAL_COLORS[signal] ?? SIGNAL_COLORS.neutral;
    const icon  = SIGNAL_ICONS[signal]  ?? '—';

    badge.style.borderColor = color;
    badge.innerHTML = `
      <span class="sca-badge-icon">${icon}</span>
      <span class="sca-badge-label" style="color:${color}">${label}</span>
      <span class="sca-badge-meta">
        Confidence: ${formatScore(confidenceScore)} &bull;
        Margin: ${formatPct(profitabilityPct / 100)}
      </span>
    `;

    this.attachBadgeToItem(itemId, badge);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private createBadge(itemId: number): HTMLElement {
    const badge = document.createElement('div');
    badge.className = 'sca-signal-badge';
    badge.dataset['itemId'] = String(itemId);
    return badge;
  }

  /**
   * Find the DOM element corresponding to a market item by itemId.
   * Sim Companies renders item IDs in data attributes or URL fragments.
   * We scan for them by common attribute patterns.
   */
  private attachBadgeToItem(itemId: number, badge: HTMLElement): void {
    const selectors = [
      `[data-resource-id="${itemId}"]`,
      `[data-item-id="${itemId}"]`,
      `[href*="/market/${itemId}"]`,
      `[href*="/resource/${itemId}"]`,
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const container = el.closest('tr, .market-row, .resource-card, li') ?? el;
        if (!container.contains(badge)) {
          (container as HTMLElement).style.position = 'relative';
          container.appendChild(badge);
        }
        return;
      }
    }

    // Fallback: append to overlay root
    if (this.root && !this.root.contains(badge)) {
      this.root.appendChild(badge);
    }
  }

  /** Watch for new market rows added by the SPA */
  private attachDOMObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          // Re-position existing badges when DOM changes
          for (const [itemId, badge] of this.badges) {
            this.attachBadgeToItem(itemId, badge);
          }
          break;
        }
      }
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  private injectStyles(): void {
    if (document.getElementById(OVERLAY_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = OVERLAY_STYLE_ID;
    style.textContent = `
      .sca-signal-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        background: rgba(0,0,0,0.75);
        backdrop-filter: blur(6px);
        border: 1px solid transparent;
        border-radius: 6px;
        font-size: 11px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #e2e8f0;
        pointer-events: none;
        z-index: 9999;
        white-space: nowrap;
        position: relative;
      }
      .sca-badge-label {
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .sca-badge-meta {
        color: #94a3b8;
        font-size: 10px;
      }
      .sca-badge-icon {
        font-size: 10px;
      }
    `;
    document.head.appendChild(style);
  }
}

export const overlayInjector = new OverlayInjector();
