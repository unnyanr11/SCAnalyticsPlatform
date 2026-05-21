/**
 * Shadow DOM host management.
 * Creates an isolated shadow root per anchor element so the overlay's
 * CSS never leaks into — or is polluted by — the Sim Companies stylesheet.
 */
import { OVERLAY_CSS } from './overlayStyles';

export interface ShadowHostRef {
  host: HTMLElement;
  root: ShadowRoot;
  /** Mount point inside the shadow root where React renders. */
  mountPoint: HTMLDivElement;
  destroy: () => void;
}

/**
 * Attach a shadow DOM host next to `anchor` (insertAdjacentElement).
 * The host element is given `pointer-events: none` to prevent any
 * interference with game interactions.
 */
export function createShadowHost(
  anchor: Element,
  position: InsertPosition = 'afterend',
  hostId?: string,
): ShadowHostRef {
  const host = document.createElement('div');
  host.dataset.scaHost = hostId ?? 'overlay';
  host.style.cssText = [
    'display:inline-block',
    'vertical-align:middle',
    'pointer-events:none',
    'position:relative',
    'z-index:2147483647',
    'contain:layout style',
  ].join(';');

  anchor.insertAdjacentElement(position, host);

  const root = host.attachShadow({ mode: 'open' });

  // Inject scoped CSS into the shadow root
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(OVERLAY_CSS);
  root.adoptedStyleSheets = [sheet];

  // Mount point for React
  const mountPoint = document.createElement('div');
  root.appendChild(mountPoint);

  const destroy = () => {
    host.remove();
  };

  return { host, root, mountPoint, destroy };
}

/**
 * Re-use or create a shadow host identified by `hostId` within a parent.
 */
export function getOrCreateShadowHost(
  anchor: Element,
  hostId: string,
  position: InsertPosition = 'afterend',
): ShadowHostRef {
  // Reuse existing host if already injected
  const existing = anchor.parentElement?.querySelector(
    `[data-sca-host="${hostId}"]`,
  ) as HTMLElement | null;

  if (existing?.shadowRoot) {
    const mountPoint = existing.shadowRoot.querySelector('div') as HTMLDivElement;
    return {
      host: existing,
      root: existing.shadowRoot,
      mountPoint,
      destroy: () => existing.remove(),
    };
  }

  return createShadowHost(anchor, position, hostId);
}
