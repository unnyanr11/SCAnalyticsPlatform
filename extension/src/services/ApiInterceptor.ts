/**
 * SC Analytics Platform — API Interceptor
 *
 * Patches window.fetch and XMLHttpRequest in the page context to observe
 * Sim Companies and SimcoTools API responses without automating anything.
 *
 * Injected via the content script into the main world.
 * ⚠️ Read-only — only observes responses, never modifies requests or initiates
 *   actions on behalf of the user.
 */

import { MARKET_URL_PATTERNS } from '../utils/constants';
import { log } from '../utils/logger';

type InterceptCallback = (url: string, data: unknown, timestamp: number) => void;

export class ApiInterceptor {
  private callbacks: InterceptCallback[] = [];
  private originalFetch: typeof window.fetch;
  private OriginalXHR: typeof XMLHttpRequest;
  private active = false;

  constructor() {
    this.originalFetch = window.fetch.bind(window);
    this.OriginalXHR   = window.XMLHttpRequest;
  }

  /** Register a callback to be called with every intercepted market response. */
  onResponse(cb: InterceptCallback): void {
    this.callbacks.push(cb);
  }

  /** Start intercepting fetch and XHR. Call once from content script. */
  install(): void {
    if (this.active) return;
    this.active = true;
    this.patchFetch();
    this.patchXHR();
    log.info('[Interceptor] Installed on', window.location.hostname);
  }

  /** Remove patches and restore originals. */
  uninstall(): void {
    if (!this.active) return;
    window.fetch = this.originalFetch;
    // XHR restore: simply deregister callbacks—prototype patch is non-destructive
    this.callbacks = [];
    this.active = false;
    log.info('[Interceptor] Uninstalled');
  }

  // -------------------------------------------------------------------------
  // Private: fetch patch
  // -------------------------------------------------------------------------

  private patchFetch(): void {
    const self = this;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const response = await self.originalFetch(input, init);
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();

      if (self.isMarketUrl(url)) {
        const clone = response.clone();
        void clone.json().then((data: unknown) => {
          self.emit(url, data, Date.now());
        }).catch(() => { /* non-JSON response, ignore */ });
      }

      return response;
    };
  }

  // -------------------------------------------------------------------------
  // Private: XHR patch
  // -------------------------------------------------------------------------

  private patchXHR(): void {
    const self = this;
    const NativeXHR = this.OriginalXHR;

    // Extend prototype so existing XHR instances are also covered
    const nativeOpen = NativeXHR.prototype.open as (
      method: string,
      url: string | URL,
      async?: boolean,
      user?: string,
      password?: string,
    ) => void;

    NativeXHR.prototype.open = function (
      this: XMLHttpRequest & { _scaUrl?: string },
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      this._scaUrl = url.toString();
      // @ts-expect-error variadic
      return nativeOpen.apply(this, [method, url, ...rest]);
    };

    const nativeAddEvent = NativeXHR.prototype.addEventListener;

    NativeXHR.prototype.addEventListener = function (
      this: XMLHttpRequest & { _scaUrl?: string },
      type: string,
      listener: EventListenerOrEventListenerObject,
      ...options: unknown[]
    ) {
      if (type === 'load' && this._scaUrl && self.isMarketUrl(this._scaUrl)) {
        const url = this._scaUrl;
        const wrappedListener = (evt: Event) => {
          if (typeof listener === 'function') listener(evt);
          else listener.handleEvent(evt);
          try {
            const data: unknown = JSON.parse((evt.target as XMLHttpRequest).responseText);
            self.emit(url, data, Date.now());
          } catch {
            // non-JSON, ignore
          }
        };
        // @ts-expect-error variadic
        return nativeAddEvent.apply(this, [type, wrappedListener, ...options]);
      }
      // @ts-expect-error variadic
      return nativeAddEvent.apply(this, [type, listener, ...options]);
    };
  }

  // -------------------------------------------------------------------------
  // Private: helpers
  // -------------------------------------------------------------------------

  private isMarketUrl(url: string): boolean {
    return MARKET_URL_PATTERNS.some((p) => p.test(url));
  }

  private emit(url: string, data: unknown, timestamp: number): void {
    for (const cb of this.callbacks) {
      try { cb(url, data, timestamp); }
      catch (err) { log.error('[Interceptor] Callback error:', err); }
    }
  }
}

export const apiInterceptor = new ApiInterceptor();
