/**
 * SC Analytics Platform — Cache Key & Expiry Utilities
 */

export function createCacheKey(url: string): string {
  // Normalize URL to a consistent cache key
  return `sca:${encodeURIComponent(url).slice(0, 200)}`;
}

export function isExpired(expiresAt: number, now = Date.now()): boolean {
  return expiresAt < now;
}

export function buildEntry<T>(data: T, ttlMs: number): {
  data: T;
  cachedAt: number;
  expiresAt: number;
} {
  const now = Date.now();
  return { data, cachedAt: now, expiresAt: now + ttlMs };
}
