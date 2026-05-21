/**
 * SC Analytics Platform — Interception Cache
 *
 * Multi-tier, TTL-aware storage for all intercepted market data.
 * Tier 1: In-memory Map (instant access, lost on popup close / SW restart)
 * Tier 2: chrome.storage.local (persistent across popup reloads)
 *
 * Features:
 *   • Per-entry TTL (driven by EndpointRegistry.ttlFor)
 *   • LRU eviction when memory tier exceeds MAX_MEMORY_ENTRIES
 *   • Ring-buffer snapshot history per resource (last N snapshots)
 *   • Batch-write to storage.local to minimise write IOPS
 *   • Fully async — never blocks the interceptor hot path
 *
 * ⚠️ Analytics only — no gameplay data is written, only market snapshots.
 */

import type { MarketSnapshot, ResourceInfo, EconomyPhase } from '../types/market';
import { endpointRegistry } from './EndpointRegistry';
import { log }              from '../utils/logger';

const MAX_MEMORY_ENTRIES   = 200;
const HISTORY_RING_SIZE    = 60;     // max snapshots kept per resource
const STORAGE_PREFIX       = 'sca:cache:';
const HISTORY_PREFIX       = 'sca:hist:';
const WRITE_DEBOUNCE_MS    = 400;    // batch writes

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface MemEntry<T> {
  data:      T;
  expiresAt: number;
  accessedAt: number;
}

interface StorageEntry<T> {
  data:      T;
  expiresAt: number;
  storedAt:  number;
}

// ---------------------------------------------------------------------------
// InterceptionCache
// ---------------------------------------------------------------------------

export class InterceptionCache {
  /** Tier-1: in-memory LRU */
  private mem = new Map<string, MemEntry<unknown>>();

  /** Pending writes to be flushed to storage.local */
  private pendingWrites = new Map<string, StorageEntry<unknown>>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  // =========================================================================
  // Snapshots
  // =========================================================================

  /**
   * Store a market snapshot.
   * TTL is looked up from the EndpointRegistry by resource ID.
   */
  async setSnapshot(snapshot: MarketSnapshot, url: string): Promise<void> {
    const ttlMs = endpointRegistry.ttlFor(url) || 60_000;
    const key   = snapshotKey(snapshot.resourceId, snapshot.realm);

    this.memSet(key, snapshot, ttlMs);
    this.queueWrite(key, snapshot, ttlMs);

    // Append to ring-buffer history
    await this.appendHistory(snapshot);
  }

  /** Get a snapshot (memory-first, then storage.local). */
  async getSnapshot(
    resourceId: number,
    realm: number,
  ): Promise<MarketSnapshot | null> {
    const key = snapshotKey(resourceId, realm);
    return this.get<MarketSnapshot>(key);
  }

  // =========================================================================
  // Resource Info
  // =========================================================================

  async setResources(resources: ResourceInfo[], url: string): Promise<void> {
    const ttlMs = endpointRegistry.ttlFor(url) || 6 * 60 * 60_000;
    for (const res of resources) {
      const key = resourceKey(res.id);
      this.memSet(key, res, ttlMs);
      this.queueWrite(key, res, ttlMs);
    }
    this.scheduleFlush();
  }

  async getResource(id: number): Promise<ResourceInfo | null> {
    return this.get<ResourceInfo>(resourceKey(id));
  }

  async getAllResources(): Promise<ResourceInfo[]> {
    // Only reads from storage — returns everything with the resource: prefix
    const all = await chrome.storage.local.get(null);
    const now = Date.now();
    const results: ResourceInfo[] = [];

    for (const [k, v] of Object.entries(all)) {
      if (!k.startsWith(STORAGE_PREFIX + 'res:')) continue;
      const entry = v as StorageEntry<ResourceInfo>;
      if (entry.expiresAt > now) results.push(entry.data);
    }

    return results;
  }

  // =========================================================================
  // Economy Phase
  // =========================================================================

  async setPhase(phase: EconomyPhase, url: string): Promise<void> {
    const ttlMs = endpointRegistry.ttlFor(url) || 15 * 60_000;
    const key   = phaseKey(phase.realm);
    this.memSet(key, phase, ttlMs);
    this.queueWrite(key, phase, ttlMs);
  }

  async getPhase(realm: number): Promise<EconomyPhase | null> {
    return this.get<EconomyPhase>(phaseKey(realm));
  }

  // =========================================================================
  // Snapshot History Ring Buffer
  // =========================================================================

  /**
   * Returns up to HISTORY_RING_SIZE snapshots for a resource,
   * ordered oldest → newest.
   */
  async getHistory(
    resourceId: number,
    realm: number,
  ): Promise<MarketSnapshot[]> {
    const key    = historyKey(resourceId, realm);
    const result = await chrome.storage.local.get(key);
    return (result[key] as MarketSnapshot[] | undefined) ?? [];
  }

  // =========================================================================
  // Eviction
  // =========================================================================

  /** Remove all expired entries from storage.local. Returns count removed. */
  async evictExpired(): Promise<number> {
    const all = await chrome.storage.local.get(null);
    const now = Date.now();
    const stale: string[] = [];

    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith(STORAGE_PREFIX)) continue;
      const entry = value as StorageEntry<unknown>;
      if (entry.expiresAt && entry.expiresAt < now) stale.push(key);
    }

    if (stale.length > 0) {
      await chrome.storage.local.remove(stale);
      log.debug(`[Cache] Evicted ${stale.length} expired entries`);
    }

    this.evictMemLRU();
    return stale.length;
  }

  /** Clear all SCA cache entries (but not user preferences / alerts). */
  async clearAll(): Promise<void> {
    this.mem.clear();
    const all  = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith(STORAGE_PREFIX) || k.startsWith(HISTORY_PREFIX));
    if (keys.length > 0) await chrome.storage.local.remove(keys);
    log.info('[Cache] Cleared all interception cache entries');
  }

  // =========================================================================
  // Diagnostics
  // =========================================================================

  memSize(): number { return this.mem.size; }

  async storageSize(): Promise<number> {
    const all = await chrome.storage.local.get(null);
    return Object.keys(all).filter(
      (k) => k.startsWith(STORAGE_PREFIX) || k.startsWith(HISTORY_PREFIX),
    ).length;
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private memSet<T>(key: string, data: T, ttlMs: number): void {
    this.mem.set(key, {
      data,
      expiresAt:  Date.now() + ttlMs,
      accessedAt: Date.now(),
    });
    if (this.mem.size > MAX_MEMORY_ENTRIES) this.evictMemLRU();
  }

  private memGet<T>(key: string): T | null {
    const entry = this.mem.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.mem.delete(key);
      return null;
    }
    entry.accessedAt = Date.now();
    return entry.data as T;
  }

  private evictMemLRU(): void {
    if (this.mem.size <= MAX_MEMORY_ENTRIES) return;
    // Sort by accessedAt ascending, remove oldest 20%
    const sorted = [...this.mem.entries()].sort(
      ([, a], [, b]) => a.accessedAt - b.accessedAt,
    );
    const removeCount = Math.ceil(this.mem.size * 0.2);
    for (let i = 0; i < removeCount; i++) {
      this.mem.delete(sorted[i]![0]);
    }
  }

  private async get<T>(key: string): Promise<T | null> {
    // Tier 1: memory
    const mem = this.memGet<T>(key);
    if (mem !== null) return mem;

    // Tier 2: storage.local
    try {
      const result = await chrome.storage.local.get(STORAGE_PREFIX + key);
      const entry  = result[STORAGE_PREFIX + key] as StorageEntry<T> | undefined;
      if (!entry || entry.expiresAt < Date.now()) return null;

      // Warm memory tier
      this.memSet(key, entry.data, entry.expiresAt - Date.now());
      return entry.data;
    } catch (err) {
      log.warn('[Cache] storage.local read error:', err);
      return null;
    }
  }

  private queueWrite<T>(key: string, data: T, ttlMs: number): void {
    this.pendingWrites.set(STORAGE_PREFIX + key, {
      data,
      expiresAt: Date.now() + ttlMs,
      storedAt:  Date.now(),
    });
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => {
      void this.flush();
    }, WRITE_DEBOUNCE_MS);
  }

  private async flush(): Promise<void> {
    this.flushTimer = null;
    if (this.pendingWrites.size === 0) return;

    const batch = Object.fromEntries(this.pendingWrites);
    this.pendingWrites.clear();

    try {
      await chrome.storage.local.set(batch);
      log.debug(`[Cache] Flushed ${Object.keys(batch).length} entries to storage.local`);
    } catch (err) {
      log.warn('[Cache] storage.local write error:', err);
    }
  }

  private async appendHistory(snapshot: MarketSnapshot): Promise<void> {
    const key = historyKey(snapshot.resourceId, snapshot.realm);
    try {
      const result  = await chrome.storage.local.get(key);
      const history = (result[key] as MarketSnapshot[] | undefined) ?? [];
      history.push(snapshot);
      if (history.length > HISTORY_RING_SIZE) history.splice(0, history.length - HISTORY_RING_SIZE);
      await chrome.storage.local.set({ [key]: history });
    } catch (err) {
      log.warn('[Cache] History append error:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

function snapshotKey(resourceId: number, realm: number): string {
  return `snap:${realm}:${resourceId}`;
}

function resourceKey(id: number): string {
  return `res:${id}`;
}

function phaseKey(realm: number): string {
  return `phase:${realm}`;
}

function historyKey(resourceId: number, realm: number): string {
  return `${HISTORY_PREFIX}${realm}:${resourceId}`;
}

export const interceptionCache = new InterceptionCache();
