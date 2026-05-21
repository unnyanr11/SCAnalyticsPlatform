/**
 * SC Analytics Platform — API Event Emitter
 *
 * Typed, synchronous event bus for all API interception events.
 * Decouples the interceptor (data source) from downstream consumers
 * (storage, overlay, background relay, AI analysis pipeline).
 *
 * Design:
 *   • Strongly typed events with generic payloads
 *   • Synchronous, ordered dispatch (no async listeners needed —
 *     async work goes in the handler, not the bus)
 *   • Automatic listener cleanup via returned unsubscribe function
 *   • Optional one-time listener support
 *   • Error isolation — a failing listener never breaks other listeners
 *
 * ⚠️ Analytics only. Event payloads are read-only — never mutate them.
 */

import type { ParsedResponse } from './ResponseParser';
import type { MarketOffer, MarketSnapshot, ResourceInfo, EconomyPhase } from '../types/market';
import { log } from '../utils/logger';

// ---------------------------------------------------------------------------
// Event catalogue
// ---------------------------------------------------------------------------

export interface ApiEventMap {
  /**
   * Fired after a raw response is intercepted, parsed, and validated.
   * Carries the full normalised ParsedResponse.
   */
  'response:parsed': ParsedResponse;

  /**
   * Fired when a market offers endpoint is successfully parsed.
   * Includes both raw offers and the computed snapshot.
   */
  'market:offers': {
    resourceId: number;
    realm:      0 | 1;
    offers:     MarketOffer[];
    snapshot:   MarketSnapshot;
    timestamp:  number;
  };

  /**
   * Fired when encyclopedia or retail info resources are parsed.
   */
  'resources:updated': {
    source:    'encyclopedia' | 'retail_info' | 'simcotools';
    resources: ResourceInfo[];
    realm:     0 | 1;
    timestamp: number;
  };

  /**
   * Fired when an economy phase response is parsed.
   */
  'phase:updated': {
    phase:     EconomyPhase;
    timestamp: number;
  };

  /**
   * Fired for every raw intercepted request — before parsing.
   * Consumers can use this for custom analysis or debugging.
   */
  'request:intercepted': {
    url:       string;
    data:      unknown;
    timestamp: number;
  };

  /**
   * Fired when a response fails schema validation.
   */
  'response:invalid': {
    url:    string;
    errors: string[];
  };

  /**
   * Fired when a WebSocket frame is received.
   */
  'ws:frame': {
    event:      string;
    data:       unknown;
    receivedAt: number;
  };

  /**
   * Fired when a rate-limit is triggered (request was suppressed).
   */
  'ratelimit:hit': {
    url:       string;
    retryAfterMs: number;
  };
}

export type ApiEventName = keyof ApiEventMap;
export type ApiEventPayload<E extends ApiEventName> = ApiEventMap[E];
export type ApiEventListener<E extends ApiEventName> = (payload: ApiEventPayload<E>) => void;

type ListenerEntry<E extends ApiEventName> = {
  listener: ApiEventListener<E>;
  once:     boolean;
};

// ---------------------------------------------------------------------------
// ApiEventEmitter
// ---------------------------------------------------------------------------

export class ApiEventEmitter {
  // Using `any` only in the internal registry — public API is fully typed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners = new Map<ApiEventName, ListenerEntry<any>[]>();

  // -------------------------------------------------------------------------
  // Subscribe
  // -------------------------------------------------------------------------

  /**
   * Add a listener for an event. Returns an unsubscribe function.
   * @example
   *   const off = emitter.on('market:offers', (e) => console.log(e.snapshot));
   *   // later: off();
   */
  on<E extends ApiEventName>(
    event: E,
    listener: ApiEventListener<E>,
  ): () => void {
    return this.addListener(event, listener, false);
  }

  /** Like `on()` but the listener fires only once. */
  once<E extends ApiEventName>(
    event: E,
    listener: ApiEventListener<E>,
  ): () => void {
    return this.addListener(event, listener, true);
  }

  /** Remove a specific listener. */
  off<E extends ApiEventName>(
    event: E,
    listener: ApiEventListener<E>,
  ): void {
    const entries = this.listeners.get(event);
    if (!entries) return;
    const filtered = entries.filter((e) => e.listener !== listener);
    this.listeners.set(event, filtered);
  }

  /** Remove all listeners for an event, or all listeners if no event given. */
  removeAllListeners(event?: ApiEventName): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  // -------------------------------------------------------------------------
  // Emit
  // -------------------------------------------------------------------------

  /** Dispatch an event to all registered listeners. */
  emit<E extends ApiEventName>(event: E, payload: ApiEventPayload<E>): void {
    const entries = this.listeners.get(event);
    if (!entries || entries.length === 0) return;

    const remaining: ListenerEntry<E>[] = [];

    for (const entry of entries) {
      try {
        entry.listener(payload);
      } catch (err) {
        log.error(`[ApiEventEmitter] Listener error on event '${event}':`, err);
      }
      if (!entry.once) remaining.push(entry);
    }

    this.listeners.set(event, remaining);
  }

  // -------------------------------------------------------------------------
  // Introspection
  // -------------------------------------------------------------------------

  listenerCount(event: ApiEventName): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private addListener<E extends ApiEventName>(
    event: E,
    listener: ApiEventListener<E>,
    once: boolean,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push({ listener, once });
    return () => this.off(event, listener);
  }
}

/** Singleton emitter shared across the entire extension. */
export const apiEmitter = new ApiEventEmitter();
