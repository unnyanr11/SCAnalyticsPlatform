/**
 * SC Analytics Platform — Content Script Entry Point
 *
 * Bootstraps the entire interception system when the content script
 * is injected into a simcompanies.com page.
 *
 * Boot order:
 *   1. Validate we are on a supported domain
 *   2. Install ApiInterceptor (fetch + XHR patches)
 *   3. Install WebSocketMonitor
 *   4. Install BackgroundRelay (event → service worker bridge)
 *   5. Schedule periodic cache eviction
 *   6. Register page-unload cleanup
 *
 * ⚠️ This file ONLY wires analytics infrastructure.
 *    It NEVER automates, clicks, submits, or modifies game UI.
 */

import { apiInterceptor }   from '../services/ApiInterceptor';
import { wsMonitor }        from '../services/WebSocketMonitor';
import { backgroundRelay }  from '../services/BackgroundRelay';
import { interceptionCache } from '../services/InterceptionCache';
import { log }              from '../utils/logger';

const SUPPORTED_ORIGIN = 'https://www.simcompanies.com';
const EVICTION_INTERVAL_MS = 5 * 60_000; // evict expired cache entries every 5 min

function boot(): void {
  // Guard: only run on the game domain
  if (!window.location.origin.startsWith(SUPPORTED_ORIGIN.replace('www.', ''))) {
    log.warn('[Content] Not on simcompanies.com — aborting boot');
    return;
  }

  log.info('[Content] Booting SCA interception system on', window.location.href);

  // Install interception stack
  apiInterceptor.install();
  wsMonitor.install();
  backgroundRelay.install();

  // Periodic expired-entry eviction
  const evictionTimer = setInterval(() => {
    void interceptionCache.evictExpired();
  }, EVICTION_INTERVAL_MS);

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(evictionTimer);
    backgroundRelay.uninstall();
    wsMonitor.uninstall();
    apiInterceptor.uninstall();
    log.info('[Content] Interception system torn down on page unload');
  }, { once: true });
}

// Run after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
