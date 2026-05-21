/**
 * SC Analytics Platform — Rate Limiter
 *
 * Token-bucket rate limiter for outgoing analytical API requests.
 * Prevents hammering SimCompanies or SimcoTools servers.
 *
 * Per-host buckets — each distinct host gets its own token allocation:
 *   www.simcompanies.com  → 10 tokens, refill 1/sec
 *   api.simcotools.com    → 5  tokens, refill 1/2sec
 *   simcotools.app        → 5  tokens, refill 1/2sec
 *   default               → 20 tokens, refill 2/sec
 *
 * Usage:
 *   if (!rateLimiter.tryConsume(url)) {
 *     // request suppressed — retry later
 *     return;
 *   }
 *   // proceed with fetch
 *
 * ⚠️ Read-only analytics. Never used to throttle write operations
 *   (the extension has none).
 */

export interface BucketConfig {
  capacity:      number;   // maximum tokens
  refillRate:    number;   // tokens added per refillIntervalMs
  refillIntervalMs: number;
}

interface Bucket {
  tokens:      number;
  lastRefillAt: number;
  config:      BucketConfig;
}

const HOST_CONFIGS: Record<string, BucketConfig> = {
  'www.simcompanies.com': { capacity: 10, refillRate: 1, refillIntervalMs: 1000 },
  'simcompanies.com':     { capacity: 10, refillRate: 1, refillIntervalMs: 1000 },
  'api.simcotools.com':   { capacity: 5,  refillRate: 1, refillIntervalMs: 2000 },
  'simcotools.app':       { capacity: 5,  refillRate: 1, refillIntervalMs: 2000 },
};

const DEFAULT_CONFIG: BucketConfig = {
  capacity:         20,
  refillRate:       2,
  refillIntervalMs: 1000,
};

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  /**
   * Try to consume one token for the given URL.
   * Returns true (allow) or false (suppress).
   */
  tryConsume(url: string): boolean {
    const host   = extractHost(url);
    const bucket = this.getOrCreateBucket(host);
    this.refill(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }

  /**
   * How many milliseconds until at least one token is available.
   * Returns 0 if a token is available immediately.
   */
  retryAfterMs(url: string): number {
    const host   = extractHost(url);
    const bucket = this.getOrCreateBucket(host);
    this.refill(bucket);
    if (bucket.tokens >= 1) return 0;
    const elapsed = Date.now() - bucket.lastRefillAt;
    return Math.max(0, bucket.config.refillIntervalMs - elapsed);
  }

  /** Current token count for a host (for diagnostics). */
  tokenCount(url: string): number {
    const host   = extractHost(url);
    const bucket = this.buckets.get(host);
    if (!bucket) return this.configFor(host).capacity;
    this.refill(bucket);
    return bucket.tokens;
  }

  /** Reset all buckets (useful in tests or after a long idle). */
  reset(): void {
    this.buckets.clear();
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private getOrCreateBucket(host: string): Bucket {
    if (!this.buckets.has(host)) {
      const config = this.configFor(host);
      this.buckets.set(host, {
        tokens:       config.capacity,
        lastRefillAt: Date.now(),
        config,
      });
    }
    return this.buckets.get(host)!;
  }

  private refill(bucket: Bucket): void {
    const now     = Date.now();
    const elapsed = now - bucket.lastRefillAt;
    const periods = Math.floor(elapsed / bucket.config.refillIntervalMs);
    if (periods <= 0) return;

    bucket.tokens = Math.min(
      bucket.config.capacity,
      bucket.tokens + periods * bucket.config.refillRate,
    );
    bucket.lastRefillAt = now;
  }

  private configFor(host: string): BucketConfig {
    return HOST_CONFIGS[host] ?? DEFAULT_CONFIG;
  }
}

function extractHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 40); // fallback for malformed URLs
  }
}

export const rateLimiter = new RateLimiter();
