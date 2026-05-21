/**
 * api_client.js — Low-level fetch wrapper with retry + rate-limit handling
 *
 * Features:
 *  - Exponential back-off with jitter on 429 / 5xx responses
 *  - Respects Retry-After header when present
 *  - Per-origin request queue with configurable concurrency cap
 *  - AbortController timeout on every request
 *  - Emits structured error objects so callers never receive raw exceptions
 *
 * @module services/api_client
 */

'use strict';

import { err } from './schema.js';

/** Default options that can be overridden per-call. */
const DEFAULTS = {
  timeoutMs:    10_000,
  maxRetries:   3,
  baseDelayMs:  400,   // first back-off delay
  maxDelayMs:   15_000,
  headers:      {},
};

/** Track in-flight counts per origin for a soft rate-limit guard. */
const _inFlight = new Map();
const MAX_CONCURRENT_PER_ORIGIN = 4;

/**
 * Sleep for `ms` milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Jittered exponential back-off delay.
 * Formula: min(maxDelayMs, baseDelay * 2^attempt) * (0.8 + random*0.4)
 */
function backoffDelay(attempt, baseDelayMs, maxDelayMs) {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  return Math.floor(exp * (0.8 + Math.random() * 0.4));
}

/**
 * Core fetch with retry, timeout, and rate-limit awareness.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {number}  [options.timeoutMs]
 * @param {number}  [options.maxRetries]
 * @param {number}  [options.baseDelayMs]
 * @param {number}  [options.maxDelayMs]
 * @param {object}  [options.headers]
 * @param {string}  [options.provider]   - label for error messages
 * @returns {Promise<{ ok: boolean, data?: any, error?: string, code?: string, status?: number }>}
 */
export async function apiFetch(url, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const origin = (() => { try { return new URL(url).origin; } catch { return url; } })();
  const provider = opts.provider ?? origin;

  // ---- concurrency guard --------------------------------------------------
  while ((_inFlight.get(origin) ?? 0) >= MAX_CONCURRENT_PER_ORIGIN) {
    await sleep(100);
  }
  _inFlight.set(origin, (_inFlight.get(origin) ?? 0) + 1);

  let lastError;

  try {
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

      try {
        const response = await fetch(url, {
          signal:  controller.signal,
          headers: {
            'Accept':       'application/json',
            'Content-Type': 'application/json',
            ...opts.headers,
          },
        });
        clearTimeout(timer);

        // ---- rate-limited -------------------------------------------------
        if (response.status === 429) {
          const retryAfterSec = parseInt(response.headers.get('Retry-After') ?? '5', 10);
          const delay = Math.min(retryAfterSec * 1000, opts.maxDelayMs);
          console.warn(`[api_client] 429 from ${origin} — waiting ${delay}ms (attempt ${attempt})`);
          if (attempt < opts.maxRetries) { await sleep(delay); continue; }
          return err(`Rate limited by ${origin}`, 'RATE_LIMITED', provider);
        }

        // ---- server errors ------------------------------------------------
        if (response.status >= 500) {
          lastError = err(`Server error ${response.status} from ${origin}`, 'SERVER_ERROR', provider);
          if (attempt < opts.maxRetries) {
            await sleep(backoffDelay(attempt, opts.baseDelayMs, opts.maxDelayMs));
            continue;
          }
          return lastError;
        }

        // ---- client errors (don't retry) ----------------------------------
        if (!response.ok) {
          return err(`HTTP ${response.status} from ${url}`, 'CLIENT_ERROR', provider);
        }

        // ---- success -------------------------------------------------------
        const data = await response.json();
        return { ok: true, data, status: response.status };

      } catch (fetchErr) {
        clearTimeout(timer);

        if (fetchErr.name === 'AbortError') {
          lastError = err(`Request to ${url} timed out after ${opts.timeoutMs}ms`, 'TIMEOUT', provider);
        } else {
          lastError = err(fetchErr.message ?? String(fetchErr), 'NETWORK_ERROR', provider);
        }

        if (attempt < opts.maxRetries) {
          await sleep(backoffDelay(attempt, opts.baseDelayMs, opts.maxDelayMs));
        }
      }
    }

    return lastError ?? err(`All ${opts.maxRetries + 1} attempts failed for ${url}`, 'MAX_RETRIES', provider);

  } finally {
    _inFlight.set(origin, Math.max(0, (_inFlight.get(origin) ?? 1) - 1));
  }
}
