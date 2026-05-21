/**
 * SC Analytics Platform — Service Worker (background)
 *
 * Entry point for the Manifest V3 service worker.
 * Handles extension lifecycle and routes messages from content scripts.
 *
 * ⚠️ Analytics only — no game actions are ever performed here.
 */

import { installMessageHandler } from './messageHandler';
import { log }                   from '../utils/logger';

// Boot
installMessageHandler();
log.info('[SW] SCAnalyticsPlatform service worker started');

// Keep-alive via chrome.alarms (MV3 service workers can be terminated)
chrome.alarms.create('sca_keepalive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sca_keepalive') {
    log.debug('[SW] Keepalive ping');
  }
});
