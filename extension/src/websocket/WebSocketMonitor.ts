/**
 * SC Analytics Platform — WebSocket Monitor
 *
 * Patches window.WebSocket to observe incoming messages from Sim Companies
 * real-time streams. Read-only — no messages are sent or modified.
 */

import { log } from '../utils/logger';

type FrameCallback = (event: string, data: unknown, receivedAt: number) => void;

export class WebSocketMonitor {
  private callbacks: FrameCallback[] = [];
  private OriginalWebSocket: typeof WebSocket;
  private active = false;

  constructor() {
    this.OriginalWebSocket = window.WebSocket;
  }

  onFrame(cb: FrameCallback): void {
    this.callbacks.push(cb);
  }

  install(): void {
    if (this.active) return;
    this.active = true;
    const self = this;
    const NativeWS = this.OriginalWebSocket;

    // @ts-expect-error extending native class
    window.WebSocket = class MonitoredWebSocket extends NativeWS {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);

        this.addEventListener('message', (evt: MessageEvent<string>) => {
          try {
            const parsed = JSON.parse(evt.data) as { event?: string; data?: unknown };
            const event = parsed.event ?? 'unknown';
            const data  = parsed.data  ?? parsed;
            self.emit(event, data, Date.now());
          } catch {
            // binary or non-JSON frame — ignore
          }
        });
      }
    };

    log.info('[WSMonitor] Installed');
  }

  uninstall(): void {
    if (!this.active) return;
    window.WebSocket = this.OriginalWebSocket;
    this.callbacks = [];
    this.active = false;
    log.info('[WSMonitor] Uninstalled');
  }

  private emit(event: string, data: unknown, receivedAt: number): void {
    for (const cb of this.callbacks) {
      try { cb(event, data, receivedAt); }
      catch (err) { log.error('[WSMonitor] Callback error:', err); }
    }
  }
}

export const wsMonitor = new WebSocketMonitor();
