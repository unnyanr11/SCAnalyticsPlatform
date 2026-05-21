/**
 * SC Analytics Platform — Background Relay
 *
 * Forwards parsed API events from the content script (page context)
 * to the extension service worker (background context) via
 * chrome.runtime.sendMessage.
 *
 * Message envelope:
 *   {
 *     source:  'sca_content',
 *     event:   ApiEventName,
 *     payload: ApiEventPayload<E>,
 *     sentAt:  number,
 *   }
 *
 * The service worker registers a chrome.runtime.onMessage listener
 * (see background/messageHandler.ts) to receive these and forward
 * to the AI analysis pipeline or broadcast to the popup.
 *
 * Why relay at all?
 *   Content scripts run in the page context and can intercept network
 *   traffic, but they cannot directly access IndexedDB, make cross-origin
 *   fetch calls to the backend AI server, or maintain persistent state.
 *   The service worker has all those capabilities.
 *
 * Relay strategy:
 *   • Subscribes to all high-value ApiEmitter events
 *   • Batches messages in a short queue (50ms flush) to avoid
 *     per-frame chrome.runtime.sendMessage overhead
 *   • Drops messages silently if the service worker is unreachable
 *     (extension reload, browser sleep) — the interceptor continues
 *     to cache locally regardless
 *
 * ⚠️ Read-only relay — only parsed analytics data is relayed.
 *    No game actions, account data, or credentials are ever transmitted.
 */

import type { ApiEventName, ApiEventPayload } from './ApiEventEmitter';
import { apiEmitter }                         from './ApiEventEmitter';
import { log }                                from '../utils/logger';

const FLUSH_INTERVAL_MS = 50;
const MAX_QUEUE_SIZE    = 100;

interface RelayMessage<E extends ApiEventName = ApiEventName> {
  source:  'sca_content';
  event:   E;
  payload: ApiEventPayload<E>;
  sentAt:  number;
}

export class BackgroundRelay {
  private queue:         RelayMessage[]       = [];
  private unsubscribers: Array<() => void>    = [];
  private flushTimer:    ReturnType<typeof setInterval> | null = null;
  private active = false;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  install(): void {
    if (this.active) return;
    this.active = true;

    // Subscribe to all relay-worthy events
    this.sub('market:offers');
    this.sub('resources:updated');
    this.sub('phase:updated');
    this.sub('response:invalid');
    this.sub('ratelimit:hit');
    this.sub('ws:frame');

    this.flushTimer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    log.info('[Relay] Installed — relaying events to service worker');
  }

  uninstall(): void {
    if (!this.active) return;
    this.active = false;

    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];

    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    this.queue = [];
    log.info('[Relay] Uninstalled');
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private sub<E extends ApiEventName>(event: E): void {
    const unsub = apiEmitter.on(event, (payload) => {
      if (!this.active) return;
      this.enqueue(event, payload as ApiEventPayload<E>);
    });
    this.unsubscribers.push(unsub);
  }

  private enqueue<E extends ApiEventName>(
    event: E,
    payload: ApiEventPayload<E>,
  ): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      // Drop oldest if queue is full (shouldn't happen in normal use)
      this.queue.shift();
      log.warn('[Relay] Queue full — dropped oldest message');
    }
    this.queue.push({
      source:  'sca_content',
      event:   event as ApiEventName,
      payload: payload as ApiEventPayload<ApiEventName>,
      sentAt:  Date.now(),
    });
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0);

    for (const msg of batch) {
      try {
        await chrome.runtime.sendMessage(msg);
      } catch (err) {
        // Service worker may be inactive — log at debug level only
        log.debug('[Relay] sendMessage failed (SW inactive?):', err);
      }
    }
  }
}

export const backgroundRelay = new BackgroundRelay();
