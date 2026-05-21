/**
 * SC Analytics Platform — WebSocket Monitor
 *
 * Passively monitors WebSocket frames from Sim Companies.
 * Read-only observation — never sends game-control messages.
 */

export interface WSFrame {
  event: string;
  data: unknown;
  receivedAt: number;
}

type FrameHandler = (frame: WSFrame) => void;

export class WebSocketMonitor {
  private handlers: FrameHandler[] = [];
  private patched = false;

  /**
   * Patches the global WebSocket constructor to intercept incoming frames.
   * Only observes — never interferes with message transmission.
   */
  public install(): void {
    if (this.patched) return;
    this.patched = true;

    const self = this;
    const OriginalWebSocket = window.WebSocket;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).WebSocket = class PatchedWebSocket extends OriginalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        this.addEventListener('message', (event: MessageEvent) => {
          self.handleMessage(event.data as string);
        });
      }
    };
  }

  public onFrame(handler: FrameHandler): void {
    this.handlers.push(handler);
  }

  public uninstall(): void {
    // Cannot fully unpatch; best practice is to stop forwarding
    this.handlers = [];
  }

  private handleMessage(raw: string): void {
    try {
      const parsed = JSON.parse(raw) as { event?: string; data?: unknown };
      const frame: WSFrame = {
        event: parsed.event ?? 'unknown',
        data: parsed.data ?? parsed,
        receivedAt: Date.now(),
      };
      this.handlers.forEach((h) => h(frame));
    } catch {
      // Non-JSON frames — ignore
    }
  }
}

export const wsMonitor = new WebSocketMonitor();
