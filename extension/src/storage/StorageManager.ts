/**
 * SC Analytics Platform — Storage Manager
 *
 * Typed, async wrapper around chrome.storage.local.
 * Provides namespaced access with automatic TTL management.
 *
 * All data is stored locally on the user’s device —
 * no credentials, no account data, analytics only.
 */

import type { CacheEntry } from '../types/messages';
import type { AnalyticsSignal, EconomyPhase, MarketSnapshot } from '../types/market';
import { buildEntry, isExpired } from '../utils/cache';
import { log } from '../utils/logger';

// ---------------------------------------------------------------------------
// Storage key namespacing
// ---------------------------------------------------------------------------

const KEYS = {
  MARKET_SNAPSHOT:  (id: number, realm: number) => `sca:snap:${realm}:${id}`,
  ANALYTICS_SIGNAL: (id: number)                => `sca:signal:${id}`,
  ECONOMY_PHASE:    (realm: number)             => `sca:phase:${realm}`,
  WATCHLIST:                                       'sca:watchlist',
  USER_PREFS:                                      'sca:prefs',
  ALERT_HISTORY:                                   'sca:alerts',
} as const;

// ---------------------------------------------------------------------------
// User Preferences schema
// ---------------------------------------------------------------------------

export interface UserPreferences {
  theme:                 'dark' | 'light';
  defaultRealm:          0 | 1;
  enableNotifications:   boolean;
  enableOverlays:        boolean;
  enableShortageAlerts:  boolean;
  pollingIntervalSec:    number;
  confidenceThreshold:   number;  // 0–1 — minimum confidence to show signals
  backendUrl:            string;
}

const DEFAULT_PREFS: UserPreferences = {
  theme:                'dark',
  defaultRealm:         0,
  enableNotifications:  true,
  enableOverlays:       true,
  enableShortageAlerts: true,
  pollingIntervalSec:   30,
  confidenceThreshold:  0.6,
  backendUrl:           'http://localhost:8000',
};

// ---------------------------------------------------------------------------
// StorageManager class
// ---------------------------------------------------------------------------

export class StorageManager {
  private static instance: StorageManager;

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  // -------------------------------------------------------------------------
  // Generic get / set with TTL
  // -------------------------------------------------------------------------

  async get<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key);
    const entry = result[key] as CacheEntry | undefined;
    if (!entry) return null;
    if (isExpired(entry.expiresAt)) {
      await chrome.storage.local.remove(key);
      return null;
    }
    return entry.data as T;
  }

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    const entry: CacheEntry = {
      ...buildEntry(data, ttlMs),
      url: key,
    };
    await chrome.storage.local.set({ [key]: entry });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  // -------------------------------------------------------------------------
  // Market Snapshots  (TTL: 1 minute)
  // -------------------------------------------------------------------------

  async saveMarketSnapshot(snapshot: MarketSnapshot): Promise<void> {
    const key = KEYS.MARKET_SNAPSHOT(snapshot.resourceId, snapshot.realm);
    await this.set(key, snapshot, 60_000);
  }

  async getMarketSnapshot(
    resourceId: number,
    realm: number,
  ): Promise<MarketSnapshot | null> {
    return this.get<MarketSnapshot>(KEYS.MARKET_SNAPSHOT(resourceId, realm));
  }

  // -------------------------------------------------------------------------
  // Analytics Signals  (TTL: 5 minutes)
  // -------------------------------------------------------------------------

  async saveSignal(signal: AnalyticsSignal): Promise<void> {
    const key = KEYS.ANALYTICS_SIGNAL(signal.resourceId);
    await this.set(key, signal, 5 * 60_000);
  }

  async getSignal(resourceId: number): Promise<AnalyticsSignal | null> {
    return this.get<AnalyticsSignal>(KEYS.ANALYTICS_SIGNAL(resourceId));
  }

  // -------------------------------------------------------------------------
  // Economy Phase  (TTL: 15 minutes)
  // -------------------------------------------------------------------------

  async savePhase(phase: EconomyPhase): Promise<void> {
    const key = KEYS.ECONOMY_PHASE(phase.realm);
    await this.set(key, phase, 15 * 60_000);
  }

  async getPhase(realm: number): Promise<EconomyPhase | null> {
    return this.get<EconomyPhase>(KEYS.ECONOMY_PHASE(realm));
  }

  // -------------------------------------------------------------------------
  // Watchlist  (persistent, no TTL)
  // -------------------------------------------------------------------------

  async getWatchlist(): Promise<number[]> {
    const result = await chrome.storage.local.get(KEYS.WATCHLIST);
    return (result[KEYS.WATCHLIST] as number[] | undefined) ?? [];
  }

  async addToWatchlist(resourceId: number): Promise<void> {
    const list = await this.getWatchlist();
    if (!list.includes(resourceId)) {
      await chrome.storage.local.set({ [KEYS.WATCHLIST]: [...list, resourceId] });
    }
  }

  async removeFromWatchlist(resourceId: number): Promise<void> {
    const list = await this.getWatchlist();
    await chrome.storage.local.set({
      [KEYS.WATCHLIST]: list.filter((id) => id !== resourceId),
    });
  }

  // -------------------------------------------------------------------------
  // User Preferences  (persistent, no TTL)
  // -------------------------------------------------------------------------

  async getPreferences(): Promise<UserPreferences> {
    const result = await chrome.storage.local.get(KEYS.USER_PREFS);
    const stored = result[KEYS.USER_PREFS] as Partial<UserPreferences> | undefined;
    return { ...DEFAULT_PREFS, ...stored };
  }

  async savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
    const current = await this.getPreferences();
    await chrome.storage.local.set({ [KEYS.USER_PREFS]: { ...current, ...prefs } });
    log.info('[Storage] Preferences saved');
  }

  async resetPreferences(): Promise<void> {
    await chrome.storage.local.set({ [KEYS.USER_PREFS]: DEFAULT_PREFS });
  }

  // -------------------------------------------------------------------------
  // Alert History  (last 50 alerts, persistent)
  // -------------------------------------------------------------------------

  async getAlertHistory(): Promise<AlertRecord[]> {
    const result = await chrome.storage.local.get(KEYS.ALERT_HISTORY);
    return (result[KEYS.ALERT_HISTORY] as AlertRecord[] | undefined) ?? [];
  }

  async pushAlert(alert: AlertRecord): Promise<void> {
    const history = await this.getAlertHistory();
    const updated = [alert, ...history].slice(0, 50);
    await chrome.storage.local.set({ [KEYS.ALERT_HISTORY]: updated });
  }

  async clearAlertHistory(): Promise<void> {
    await chrome.storage.local.remove(KEYS.ALERT_HISTORY);
  }

  // -------------------------------------------------------------------------
  // Bulk eviction
  // -------------------------------------------------------------------------

  async evictExpired(): Promise<number> {
    const all = await chrome.storage.local.get(null);
    const now = Date.now();
    const stale: string[] = [];

    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith('sca:')) continue;
      const entry = value as CacheEntry;
      if (entry.expiresAt && isExpired(entry.expiresAt, now)) {
        stale.push(key);
      }
    }

    if (stale.length > 0) {
      await chrome.storage.local.remove(stale);
    }
    return stale.length;
  }
}

export interface AlertRecord {
  id:          string;
  type:        'shortage' | 'spike' | 'opportunity' | 'oversaturation';
  title:       string;
  message:     string;
  severity:    'low' | 'medium' | 'high' | 'critical';
  resourceId?: number;
  timestamp:   number;
  read:        boolean;
}

// Singleton export
export const storageManager = StorageManager.getInstance();
