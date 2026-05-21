/**
 * SC Analytics Platform — Background Service Worker
 * Manifest V3 — runs as a persistent-capable service worker.
 *
 * Responsibilities:
 *   • Route messages from content scripts
 *   • Manage chrome.storage.local cache with TTL eviction
 *   • Relay intercepted market data to the backend AI server
 *   • Schedule periodic alarm for cache cleanup and polling
 *   • Manage notification dispatching
 *
 * ⚠️ STRICTLY PROHIBITED — enforced by code review:
 *   • No automated clicks, buys, sells, or production triggers
 *   • No account mutation or unauthorized API writes
 *   • All external fetches are read-only analytics calls
 */

import type {
  BackgroundMessage,
  BackgroundResponse,
  CacheEntry,
  MarketIngestPayload,
} from '../types/messages';
import { MessageType } from '../types/messages';
import { BACKEND_URL, CACHE_TTL_MS, ALARM_INTERVAL_MINUTES } from '../utils/constants';
import { createCacheKey, isExpired } from '../utils/cache';
import { log } from '../utils/logger';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(({ reason }) => {
  log.info(`[SW] Installed. Reason: ${reason}`);
  scheduleAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  log.info('[SW] Browser started — rescheduling alarms');
  scheduleAlarms();
});

function scheduleAlarms(): void {
  chrome.alarms.clearAll(() => {
    chrome.alarms.create('sca:cache-evict', { periodInMinutes: ALARM_INTERVAL_MINUTES.CACHE_EVICT });
    chrome.alarms.create('sca:phase-poll',  { periodInMinutes: ALARM_INTERVAL_MINUTES.PHASE_POLL });
    log.info('[SW] Alarms scheduled');
  });
}

// ---------------------------------------------------------------------------
// Message Router
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundMessage,
    sender,
    sendResponse: (r: BackgroundResponse) => void,
  ) => {
    void handleMessage(message, sender).then(sendResponse);
    return true; // keep channel open for async
  },
);

async function handleMessage(
  message: BackgroundMessage,
  _sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  try {
    switch (message.type) {
      case MessageType.MARKET_DATA_INTERCEPTED:
        await handleMarketIngest(message.payload as MarketIngestPayload);
        return { ok: true };

      case MessageType.GET_CACHED_DATA: {
        const key = createCacheKey(message.payload as string);
        const entry = await getCacheEntry(key);
        return { ok: true, data: entry?.data ?? null };
      }

      case MessageType.CLEAR_CACHE:
        await clearAllCache();
        return { ok: true };

      case MessageType.DISPATCH_NOTIFICATION:
        await dispatchNotification(
          (message.payload as { title: string; body: string }).title,
          (message.payload as { title: string; body: string }).body,
        );
        return { ok: true };

      default:
        log.warn(`[SW] Unknown message type: ${String(message.type)}`);
        return { ok: false, error: 'Unknown message type' };
    }
  } catch (err) {
    log.error('[SW] Message handling error', err);
    return { ok: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Market Data Ingestion
// ---------------------------------------------------------------------------

async function handleMarketIngest(payload: MarketIngestPayload): Promise<void> {
  const key = createCacheKey(payload.url);
  const entry: CacheEntry = {
    data: payload.data,
    cachedAt: payload.timestamp,
    expiresAt: payload.timestamp + CACHE_TTL_MS,
    url: payload.url,
  };

  await chrome.storage.local.set({ [key]: entry });
  log.debug(`[SW] Cached market data for: ${payload.url}`);

  // Non-blocking relay to backend
  relayToBackend(payload).catch((err) =>
    log.warn('[SW] Backend relay failed (non-fatal):', err),
  );
}

async function relayToBackend(payload: MarketIngestPayload): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/v1/market/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: payload.url,
      data: payload.data,
      timestamp: payload.timestamp,
    }),
  });
  if (!res.ok) {
    throw new Error(`Backend responded ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Cache Helpers
// ---------------------------------------------------------------------------

async function getCacheEntry(key: string): Promise<CacheEntry | null> {
  const result = await chrome.storage.local.get(key);
  const entry = result[key] as CacheEntry | undefined;
  if (!entry || isExpired(entry.expiresAt)) return null;
  return entry;
}

async function clearAllCache(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith('sca:'));
  if (keys.length > 0) await chrome.storage.local.remove(keys);
  log.info(`[SW] Cleared ${keys.length} cache entries`);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

async function dispatchNotification(title: string, body: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.notifications.create(
      `sca-${Date.now()}`,
      {
        type: 'basic',
        iconUrl: '../assets/icons/icon-48.png',
        title: `SC Analytics: ${title}`,
        message: body,
        priority: 1,
      },
      () => resolve(),
    );
  });
}

// ---------------------------------------------------------------------------
// Alarm Handlers
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener((alarm) => {
  void handleAlarm(alarm.name);
});

async function handleAlarm(name: string): Promise<void> {
  switch (name) {
    case 'sca:cache-evict':
      await evictExpiredCache();
      break;
    case 'sca:phase-poll':
      await pollEconomyPhase();
      break;
    default:
      break;
  }
}

async function evictExpiredCache(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const now = Date.now();
  const stale: string[] = [];

  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith('sca:') && isExpired((value as CacheEntry).expiresAt, now)) {
      stale.push(key);
    }
  }

  if (stale.length > 0) {
    await chrome.storage.local.remove(stale);
    log.info(`[SW] Evicted ${stale.length} expired cache entries`);
  }
}

async function pollEconomyPhase(): Promise<void> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/analytics/economy-phase`);
    if (res.ok) {
      const phase = (await res.json()) as unknown;
      await chrome.storage.local.set({
        'sca:economy-phase': {
          data: phase,
          cachedAt: Date.now(),
          expiresAt: Date.now() + 15 * 60 * 1000, // 15 min
        },
      });
      log.debug('[SW] Economy phase updated');
    }
  } catch {
    log.warn('[SW] Economy phase poll failed (backend may be offline)');
  }
}

export {};
