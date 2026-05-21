/**
 * SC Analytics Platform — WebSocket Monitor
 *
 * Hooks window.WebSocket to passively observe frames exchanged between
 * the game and its servers.
 *
 * Design:
 *   • Wraps WebSocket constructor — every new WS instance is observed
 *   • Hooks `onmessage` and `addEventListener('message', ...)` on each socket
 *   • Attempts JSON parse on every inbound frame
 *   • Emits `ws:frame` on apiEmitter for downstream consumers
 *   • Never sends, modifies, or suppresses any frame
 *   • Fully removable via uninstall()
 *
 * Frame filtering:
 *   • Non-JSON frames (binary, plain text) are silently skipped
 *   • Frames with no meaningful data object are skipped
 *   • Optional URL-prefix filter: only observe sockets whose URL
 *     matches a known SC/ST host
 *
 * ⚠️ Read-only observation only. The monitor NEVER:
 *     - sends data to the server
 *     - modifies frames
 *     - influences game state
 */

import { apiEmitter } from './ApiEventEmitter';
import { log }        from '../utils/logger';

const OBSERVED_HOSTS = [
  'simcompanies.com',
  'simcotools.com',
  'simcotools.app',
];

export class WebSocketMonitor {
  private NativeWebSocket!: typeof WebSocket;
  private active = false;
  private openSockets = new WeakSet<WebSocket>();

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  install(): void {
    if (this.active) return;
    this.NativeWebSocket = window.WebSocket;
    this.active          = true;
    this.patchConstructor();
    log.info('[WSMonitor] Installed — observing WebSocket traffic');
  }

  uninstall(): void {
    if (!this.active) return;
    window.WebSocket = this.NativeWebSocket;
    this.active       = false;
    log.info('[WSMonitor] Uninstalled');
  }

  // -------------------------------------------------------------------------
  // Patch
  // -------------------------------------------------------------------------

  private patchConstructor(): void {
    const self   = this;
    const Native = this.NativeWebSocket;

    // We need to extend the native class while keeping instanceof checks valid
    function PatchedWebSocket(
      this: WebSocket,
      url: string | URL,
      protocols?: string | string[],
    ) {
      const ws = protocols
        ? new Native(url, protocols)
        : new Native(url);

      if (self.active && self.isObservedUrl(url.toString())) {
        self.observe(ws, url.toString());
      }

      return ws;
    }

    // Preserve prototype chain for instanceof checks
    PatchedWebSocket.prototype            = Native.prototype;
    PatchedWebSocket.CONNECTING           = Native.CONNECTING;
    PatchedWebSocket.OPEN                 = Native.OPEN;
    PatchedWebSocket.CLOSING              = Native.CLOSING;
    PatchedWebSocket.CLOSED               = Native.CLOSED;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.WebSocket = PatchedWebSocket as any;
  }

  // -------------------------------------------------------------------------
  // Observation
  // -------------------------------------------------------------------------

  private observe(ws: WebSocket, url: string): void {
    if (this.openSockets.has(ws)) return;
    this.openSockets.add(ws);

    const self = this;

    ws.addEventListener('message', (evt: MessageEvent) => {
      if (!self.active) return;
      self.handleFrame(evt, url);
    });

    ws.addEventListener('close', () => {
      log.debug(`[WSMonitor] Socket closed: ${url}`);
    });

    log.debug(`[WSMonitor] Observing socket: ${url}`);
  }

  private handleFrame(evt: MessageEvent, socketUrl: string): void {
    try {
      if (typeof evt.data !== 'string') return; // skip binary

      const data = JSON.parse(evt.data) as unknown;
      if (!data || typeof data !== 'object') return;

      // Extract event name if the frame follows a common { event, data } envelope
      const frame  = data as Record<string, unknown>;
      const event  = typeof frame['event'] === 'string' ? frame['event'] : 'ws_message';
      const payload = frame['data'] ?? data;

      apiEmitter.emit('ws:frame', {
        event,
        data:       payload,
        receivedAt: Date.now(),
      });

      log.debug(`[WSMonitor] Frame on ${socketUrl} — event: ${event}`);
    } catch {
      // Non-JSON frame — ignore silently
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private isObservedUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname;
      return OBSERVED_HOSTS.some((h) => hostname.endsWith(h));
    } catch {
      return false;
    }
  }
}

export const wsMonitor = new WebSocketMonitor();
