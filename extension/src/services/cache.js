/**
 * cache.js — In-memory TTL cache for API responses
 *
 * Stores responses in a Map with per-entry expiry.
 * No localStorage / chrome.storage — pure in-memory so no persistence
 * issues across extension reloads.
 *
 * Uses a single shared instance (singleton) exported as `cache`.
 *
 * @module services/cache
 */

'use strict';

/** Default TTL values (ms) per endpoint category */
export const TTL = {
  MARKET:        30_000,   // market offers change frequently
  ENCYCLOPEDIA:  600_000,  // resource info rarely changes
  ECONOMY_PHASE: 120_000,  // phases shift every few hours at most
  RETAIL_INFO:   300_000,  // retail prices update slowly
  SIMCOTOOLS:    60_000,   // simcotools aggregates
};

const _SWEEP_INTERVAL_MS = 60_000; // auto-eviction sweep every 60 s

class TTLCache {
  constructor() {
    /** @type {Map<string, { value: any, expiresAt: number }>} */
    this._store = new Map();
    this._sweepTimer = null;
    this._hits = 0;
    this._misses = 0;
    this._startSweep();
  }

  // ---- public API ----------------------------------------------------------

  /**
   * Retrieve a cached value. Returns `undefined` if missing or expired.
   * @param {string} key
   * @returns {any|undefined}
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) { this._misses++; return undefined; }
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      this._misses++;
      return undefined;
    }
    this._hits++;
    return entry.value;
  }

  /**
   * Store a value with a TTL.
   * @param {string} key
   * @param {any}    value
   * @param {number} [ttl=60000]  ms until expiry
   */
  set(key, value, ttl = 60_000) {
    this._store.set(key, { value, expiresAt: Date.now() + ttl });
  }

  /**
   * Check whether a non-expired entry exists.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /** Remove a specific key immediately. */
  invalidate(key) {
    this._store.delete(key);
  }

  /** Remove all entries whose keys start with `prefix`. */
  invalidatePrefix(prefix) {
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) this._store.delete(key);
    }
  }

  /** Hard-clear everything. */
  clear() {
    this._store.clear();
    this._hits = 0;
    this._misses = 0;
  }

  /** Diagnostic stats. */
  stats() {
    return {
      size: this._store.size,
      hits: this._hits,
      misses: this._misses,
      hitRate: this._hits + this._misses > 0
        ? (this._hits / (this._hits + this._misses)).toFixed(3)
        : 'n/a',
    };
  }

  // ---- internals -----------------------------------------------------------

  _startSweep() {
    this._sweepTimer = setInterval(() => this._sweep(), _SWEEP_INTERVAL_MS);
    // Don't block Node/extension shutdown
    if (this._sweepTimer?.unref) this._sweepTimer.unref();
  }

  _sweep() {
    const now = Date.now();
    for (const [key, entry] of this._store) {
      if (now > entry.expiresAt) this._store.delete(key);
    }
  }
}

/** Singleton shared across all service modules. */
export const cache = new TTLCache();
