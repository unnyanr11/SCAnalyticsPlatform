// SC Analytics Platform — Background Service Worker
// Handles alarms, caching, alert dispatch. NEVER automates gameplay.

import { AlertSystem } from '../services/alert-system.js';
import { CacheManager } from '../services/cache-manager.js';
import { DataCollector } from '../services/data-collector.js';

const POLL_INTERVAL_MINUTES = 2;

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SCA] Extension installed');
  chrome.alarms.create('market-poll', { periodInMinutes: POLL_INTERVAL_MINUTES });
  initDefaults();
});

async function initDefaults() {
  const existing = await chrome.storage.local.get('settings');
  if (!existing.settings) {
    await chrome.storage.local.set({
      settings: {
        realm: 0,
        pollInterval: POLL_INTERVAL_MINUTES,
        alertsEnabled: true,
        overlayEnabled: true,
        notifications: { shortage: true, spike: true, arbitrage: true, phase: true },
        theme: 'dark'
      }
    });
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'market-poll') {
    try {
      const collector = new DataCollector();
      await collector.pollMarket();
    } catch (err) {
      console.error('[SCA] Poll error:', err);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true;
});

async function handleMessage(message, sender, sendResponse) {
  switch (message.type) {
    case 'MARKET_DATA':
      await CacheManager.set('market_' + message.itemId, message.data, 120000);
      sendResponse({ ok: true });
      break;
    case 'GET_CACHE':
      const cached = await CacheManager.get(message.key);
      sendResponse({ data: cached });
      break;
    case 'TRIGGER_ALERT':
      await AlertSystem.dispatch(message.alert);
      sendResponse({ ok: true });
      break;
    case 'GET_SETTINGS':
      const s = await chrome.storage.local.get('settings');
      sendResponse({ settings: s.settings });
      break;
    case 'SAVE_SETTINGS':
      await chrome.storage.local.set({ settings: message.settings });
      sendResponse({ ok: true });
      break;
    default:
      sendResponse({ error: 'Unknown message type' });
  }
}
