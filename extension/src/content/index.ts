/**
 * SC Analytics Platform — Content Script Entry
 *
 * Runs in the context of https://www.simcompanies.com/*
 * Responsibilities:
 *   1. Install the API interceptor and WebSocket monitor
 *   2. Forward intercepted data to the background service worker
 *   3. Listen for overlay update messages from background
 *   4. Mount/unmount the overlay injector based on page navigation
 *
 * ⚠️ Analytics only — no automated actions.
 */

import { apiInterceptor } from '../services/ApiInterceptor';
import { wsMonitor }      from '../websocket/WebSocketMonitor';
import { overlayInjector } from '../overlays/OverlayInjector';
import { MessageType }    from '../types/messages';
import type { MarketIngestPayload, OverlayUpdatePayload } from '../types/messages';
import { log }            from '../utils/logger';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function bootstrap(): void {
  log.info('[Content] Bootstrapping SC Analytics on', window.location.href);

  // Install interceptors
  apiInterceptor.install();
  wsMonitor.install();

  // Forward intercepted market data to background
  apiInterceptor.onResponse((url, data, timestamp) => {
    const payload: MarketIngestPayload = { url, data, timestamp };
    chrome.runtime.sendMessage({ type: MessageType.MARKET_DATA_INTERCEPTED, payload });
  });

  // Forward WS frames
  wsMonitor.onFrame((event, data, receivedAt) => {
    chrome.runtime.sendMessage({
      type: MessageType.WS_FRAME_RECEIVED,
      payload: { event, data, receivedAt },
    });
  });

  // Listen for overlay update instructions from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === MessageType.OVERLAY_UPDATE) {
      const payload = message.payload as OverlayUpdatePayload;
      overlayInjector.updateSignal(payload);
    }
  });

  // Mount overlays on initial load
  overlayInjector.mount();

  // Re-mount on SPA navigation (Sim Companies is a SPA)
  observeNavigation(() => {
    overlayInjector.unmount();
    setTimeout(() => overlayInjector.mount(), 600);
  });

  log.info('[Content] Bootstrap complete');
}

// ---------------------------------------------------------------------------
// SPA Navigation Observer
// ---------------------------------------------------------------------------

function observeNavigation(onNavigate: () => void): void {
  let lastPath = window.location.pathname;

  const observer = new MutationObserver(() => {
    const currentPath = window.location.pathname;
    if (currentPath !== lastPath) {
      lastPath = currentPath;
      log.debug('[Content] SPA navigation detected:', currentPath);
      onNavigate();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also handle popstate
  window.addEventListener('popstate', () => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      onNavigate();
    }
  });
}

// Run once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
