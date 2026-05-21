/**
 * shadowMount.ts
 *
 * Creates a Shadow DOM host element attached to an anchor DOM node,
 * then mounts a React tree into it via createRoot.
 *
 * Shadow DOM provides full style isolation:
 *   - Sim Companies stylesheets cannot leak in
 *   - Our overlay styles cannot leak out
 *
 * Each call returns the ShadowRoot and React Root for the caller to
 * manage lifecycle (update props, unmount on removal).
 */

import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type React from 'react';

export interface ShadowMount {
  host: HTMLElement;
  shadow: ShadowRoot;
  root: Root;
  unmount: () => void;
}

/**
 * @param anchor  - The game DOM element to attach to.
 * @param position - Where to insert relative to anchor ('beforeend' default).
 */
export function createShadowMount(
  anchor: Element,
  position: InsertPosition = 'beforeend',
): ShadowMount {
  // Host element — display:inline-block so it flows with text/row content
  const host = document.createElement('span');
  host.className = 'sca-shadow-host';
  host.style.cssText = [
    'display:inline-block',
    'vertical-align:middle',
    'margin-left:6px',
    'position:relative',
    'z-index:9999',
    // Prevent the game from accidentally styling this element
    'all:unset',
    'display:inline-block',
    'vertical-align:middle',
    'margin-left:6px',
    'position:relative',
    'z-index:9999',
  ].join(';');

  const shadow = host.attachShadow({ mode: 'closed' });

  // React render container inside Shadow DOM
  const container = document.createElement('div');
  container.style.cssText = 'display:inline-block;position:relative;';
  shadow.appendChild(container);

  const root = createRoot(container);

  anchor.insertAdjacentElement(position, host);

  return {
    host,
    shadow,
    root,
    unmount: () => {
      root.unmount();
      host.remove();
    },
  };
}
