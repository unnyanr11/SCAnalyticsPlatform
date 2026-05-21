/**
 * SC Analytics Platform — API Interceptor (v2)
 *
 * Orchestrates the full interception pipeline:
 *
 *   fetch/XHR response
 *       │
 *       ├─ EndpointRegistry.shouldIntercept(url)  → skip if not a SC/ST URL
 *       ├─ RateLimiter.tryConsume(url)            → suppress if over limit
 *       ├─ isSaneParsedResponse(data)             → discard empty/null bodies
 *       ├─ ResponseParser.parse(url, data)        → normalise to domain types
 *       ├─ SchemaValidator                        → validate parsed result
 *       ├─ InterceptionCache.set*()               → store in two-tier cache
 *       └─ ApiEventEmitter.emit()                 → notify downstream consumers
 *
 * The interceptor itself NEVER:
 *   • Initiates requests
 *   • Modifies requests or responses
 *   • Performs any account actions
 *   • Automates any gameplay behaviour
 *
 * Patching strategy:
 *   • window.fetch    — cloned response, original returned untouched
 *   • XMLHttpRequest  — prototype-level `open` + `addEventListener` hooks
 *
 * Both patches are fully removable via uninstall().
 */

import { endpointRegistry }    from './EndpointRegistry';
import { rateLimiter }         from './RateLimiter';
import { responseParser }      from './ResponseParser';
import {
  validateMarketOffers,
  validateMarketSnapshot,
  validateResourceInfoArray,
  validateEconomyPhase,
  isSaneParsedResponse,
} from './SchemaValidator';
import { interceptionCache }   from './InterceptionCache';
import { apiEmitter }          from './ApiEventEmitter';
import { log }                 from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Low-level callback: raw URL + data before any parsing. */
type RawInterceptCallback = (url: string, data: unknown, timestamp: number) => void;

// ---------------------------------------------------------------------------
// ApiInterceptor
// ---------------------------------------------------------------------------

export class ApiInterceptor {
  private originalFetch!: typeof window.fetch;
  private OriginalXHR!:   typeof XMLHttpRequest;
  private rawCallbacks:   RawInterceptCallback[] = [];
  private active = false;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  install(): void {
    if (this.active) return;

    this.originalFetch = window.fetch.bind(window);
    this.OriginalXHR   = window.XMLHttpRequest;
    this.active        = true;

    this.patchFetch();
    this.patchXHR();

    log.info('[Interceptor] Installed — monitoring', endpointRegistry.all().length, 'endpoint patterns');
  }

  uninstall(): void {
    if (!this.active) return;
    window.fetch = this.originalFetch;
    // XHR prototype patches are removed by clearing the active flag;
    // the patched prototype checks `this.active` before processing.
    this.active       = false;
    this.rawCallbacks = [];
    log.info('[Interceptor] Uninstalled');
  }

  /** Register a low-level callback for raw (unparsed) intercepts. */
  onRaw(cb: RawInterceptCallback): () => void {
    this.rawCallbacks.push(cb);
    return () => {
      this.rawCallbacks = this.rawCallbacks.filter((c) => c !== cb);
    };
  }

  // -------------------------------------------------------------------------
  // Core pipeline
  // -------------------------------------------------------------------------

  /**
   * Called for every intercepted URL + response body.
   * Runs the full parse → validate → cache → emit pipeline.
   * Errors in any stage are caught and logged — never re-thrown.
   */
  private handleResponse(url: string, data: unknown, timestamp: number): void {
    try {
      // Gate 1: is this a monitored endpoint?
      if (!endpointRegistry.shouldIntercept(url)) return;

      // Gate 2: rate limit check (only applies to actively polled URLs,
      //         passive intercepts of in-flight game requests are always allowed)
      const rl = rateLimiter.retryAfterMs(url);
      if (rl > 0) {
        apiEmitter.emit('ratelimit:hit', { url, retryAfterMs: rl });
        log.debug(`[Interceptor] Rate limit hit for ${url}, retry in ${rl}ms`);
        return;
      }
      rateLimiter.tryConsume(url);

      // Gate 3: basic sanity on the response body
      if (!isSaneParsedResponse(data)) return;

      // Fire raw event before parsing
      apiEmitter.emit('request:intercepted', { url, data, timestamp });
      for (const cb of this.rawCallbacks) {
        try { cb(url, data, timestamp); } catch { /* isolate */ }
      }

      // Step 1: Parse
      const parsed = responseParser.parse(url, data, timestamp);
      if (!parsed) return;

      apiEmitter.emit('response:parsed', parsed);

      // Step 2: Validate + cache + emit domain events
      switch (parsed.kind) {
        case 'market_offers': {
          if (!parsed.offers?.length || !parsed.snapshot) break;

          const offersResult = validateMarketOffers(parsed.offers);
          const snapResult   = validateMarketSnapshot(parsed.snapshot);

          if (!offersResult.valid || !snapResult.valid) {
            apiEmitter.emit('response:invalid', {
              url,
              errors: [...offersResult.errors, ...snapResult.errors],
            });
            log.warn('[Interceptor] Market offers validation failed:', url, offersResult.errors, snapResult.errors);
            break;
          }

          void interceptionCache.setSnapshot(parsed.snapshot, url);

          apiEmitter.emit('market:offers', {
            resourceId: parsed.snapshot.resourceId,
            realm:      parsed.realm,
            offers:     parsed.offers,
            snapshot:   parsed.snapshot,
            timestamp,
          });
          break;
        }

        case 'encyclopedia':
        case 'retail_info':
        case 'simcotools_resources': {
          if (!parsed.resources?.length) break;

          const result = validateResourceInfoArray(parsed.resources);
          if (!result.valid) {
            apiEmitter.emit('response:invalid', { url, errors: result.errors });
            break;
          }

          void interceptionCache.setResources(parsed.resources, url);

          apiEmitter.emit('resources:updated', {
            source:    parsed.kind === 'encyclopedia' ? 'encyclopedia' :
                       parsed.kind === 'retail_info'  ? 'retail_info'  : 'simcotools',
            resources: parsed.resources,
            realm:     parsed.realm,
            timestamp,
          });
          break;
        }

        case 'simcotools_phase': {
          if (!parsed.phase) break;

          const result = validateEconomyPhase(parsed.phase);
          if (!result.valid) {
            apiEmitter.emit('response:invalid', { url, errors: result.errors });
            break;
          }

          void interceptionCache.setPhase(parsed.phase, url);

          apiEmitter.emit('phase:updated', { phase: parsed.phase, timestamp });
          break;
        }
      }
    } catch (err) {
      log.error('[Interceptor] Pipeline error for', url, err);
    }
  }

  // -------------------------------------------------------------------------
  // fetch patch
  // -------------------------------------------------------------------------

  private patchFetch(): void {
    const self = this;

    window.fetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      const response = await self.originalFetch(input, init);
      const url = resolveUrl(input);

      if (self.active && endpointRegistry.shouldIntercept(url)) {
        const clone = response.clone();
        clone
          .json()
          .then((data: unknown) => self.handleResponse(url, data, Date.now()))
          .catch(() => { /* non-JSON body — skip */ });
      }

      return response;
    };
  }

  // -------------------------------------------------------------------------
  // XHR patch
  // -------------------------------------------------------------------------

  private patchXHR(): void {
    const self   = this;
    const native = this.OriginalXHR;

    const nativeOpen = native.prototype.open as (
      method: string, url: string | URL, async?: boolean,
    ) => void;

    native.prototype.open = function (
      this: XHRWithMeta,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      this._scaUrl = url.toString();
      // @ts-expect-error variadic
      return nativeOpen.apply(this, [method, url, ...rest]);
    };

    const nativeAddEvent = native.prototype.addEventListener;

    native.prototype.addEventListener = function (
      this: XHRWithMeta,
      type: string,
      listener: EventListenerOrEventListenerObject,
      ...rest: unknown[]
    ) {
      if (
        type === 'load' &&
        self.active &&
        this._scaUrl &&
        endpointRegistry.shouldIntercept(this._scaUrl)
      ) {
        const url = this._scaUrl;
        const wrapped = (evt: Event) => {
          // Call original listener first
          if (typeof listener === 'function') listener(evt);
          else listener.handleEvent(evt);

          // Then extract data
          try {
            const text = (evt.target as XMLHttpRequest).responseText;
            const data = JSON.parse(text) as unknown;
            self.handleResponse(url, data, Date.now());
          } catch { /* non-JSON — skip */ }
        };
        // @ts-expect-error variadic
        return nativeAddEvent.apply(this, [type, wrapped, ...rest]);
      }
      // @ts-expect-error variadic
      return nativeAddEvent.apply(this, [type, listener, ...rest]);
    };
  }
}

// ---------------------------------------------------------------------------
// Private types
// ---------------------------------------------------------------------------

interface XHRWithMeta extends XMLHttpRequest {
  _scaUrl?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string')          return input;
  if (input instanceof Request)           return input.url;
  return input.toString();
}

export const apiInterceptor = new ApiInterceptor();
