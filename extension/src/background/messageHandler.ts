/**
 * SC Analytics Platform — Service Worker Message Handler
 *
 * Receives relayed API events from BackgroundRelay (content script)
 * and routes them to the appropriate background processors:
 *   • Market offers   → AI analysis queue
 *   • Phase updates   → phase store
 *   • Resource info   → resource registry
 *   • Invalid/errors  → diagnostic log
 *
 * Message schema (from BackgroundRelay):
 *   {
 *     source:  'sca_content',
 *     event:   ApiEventName,
 *     payload: ApiEventPayload<E>,
 *     sentAt:  number,
 *   }
 *
 * ⚠️ Read-only handler — never sends game actions.
 */

import type { ApiEventName, ApiEventPayload } from '../services/ApiEventEmitter';
import { log } from '../utils/logger';

type RelayMessage<E extends ApiEventName = ApiEventName> = {
  source:  'sca_content';
  event:   E;
  payload: ApiEventPayload<E>;
  sentAt:  number;
};

function isRelayMessage(msg: unknown): msg is RelayMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as RelayMessage).source === 'sca_content' &&
    typeof (msg as RelayMessage).event === 'string'
  );
}

export function installMessageHandler(): void {
  chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
    if (!isRelayMessage(msg)) return false;

    // Log latency (sentAt → received)
    const latencyMs = Date.now() - msg.sentAt;
    log.debug(`[BG] Received '${msg.event}' from tab ${sender.tab?.id} (latency: ${latencyMs}ms)`);

    routeMessage(msg);

    // Return false = no async response needed
    sendResponse({ ok: true });
    return false;
  });

  log.info('[BG] Message handler installed');
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function routeMessage(msg: RelayMessage): void {
  switch (msg.event) {
    case 'market:offers':
      handleMarketOffers(msg.payload as ApiEventPayload<'market:offers'>);
      break;

    case 'resources:updated':
      handleResourcesUpdated(msg.payload as ApiEventPayload<'resources:updated'>);
      break;

    case 'phase:updated':
      handlePhaseUpdated(msg.payload as ApiEventPayload<'phase:updated'>);
      break;

    case 'response:invalid':
      handleInvalid(msg.payload as ApiEventPayload<'response:invalid'>);
      break;

    case 'ws:frame':
      handleWsFrame(msg.payload as ApiEventPayload<'ws:frame'>);
      break;

    default:
      log.debug(`[BG] Unhandled event type: ${msg.event}`);
  }
}

// ---------------------------------------------------------------------------
// Handlers (stubs — expanded by AI engine module)
// ---------------------------------------------------------------------------

function handleMarketOffers(
  payload: ApiEventPayload<'market:offers'>,
): void {
  // TODO: enqueue for AI analysis pipeline
  log.info(
    `[BG] Market offers for resource ${payload.resourceId} (realm ${payload.realm}):`,
    `${payload.offers.length} offers, vwap=${payload.snapshot.vwap.toFixed(2)}`,
  );
}

function handleResourcesUpdated(
  payload: ApiEventPayload<'resources:updated'>,
): void {
  log.info(
    `[BG] Resources updated from ${payload.source}:`,
    `${payload.resources.length} resources (realm ${payload.realm})`,
  );
}

function handlePhaseUpdated(
  payload: ApiEventPayload<'phase:updated'>,
): void {
  log.info(
    `[BG] Economy phase: ${payload.phase.name}`,
    `(realm ${payload.phase.realm}, multiplier ${payload.phase.multiplier})`,
  );
}

function handleInvalid(
  payload: ApiEventPayload<'response:invalid'>,
): void {
  log.warn(`[BG] Invalid response from ${payload.url}:`, payload.errors);
}

function handleWsFrame(
  payload: ApiEventPayload<'ws:frame'>,
): void {
  log.debug(`[BG] WS frame — event: ${payload.event}`);
}
