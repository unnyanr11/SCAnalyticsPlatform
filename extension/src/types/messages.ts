/**
 * SC Analytics Platform — Inter-component Message Types
 *
 * All messages between content scripts, service worker, and popup.
 * Typed exhaustively — no untyped postMessage calls anywhere.
 */

export enum MessageType {
  // Content → Background
  MARKET_DATA_INTERCEPTED = 'MARKET_DATA_INTERCEPTED',
  WS_FRAME_RECEIVED       = 'WS_FRAME_RECEIVED',

  // Popup / Background ↔ Background
  GET_CACHED_DATA         = 'GET_CACHED_DATA',
  CLEAR_CACHE             = 'CLEAR_CACHE',
  DISPATCH_NOTIFICATION   = 'DISPATCH_NOTIFICATION',

  // Background → Content / Overlay
  OVERLAY_UPDATE          = 'OVERLAY_UPDATE',
  ALERT_TRIGGER           = 'ALERT_TRIGGER',
}

export interface MarketIngestPayload {
  url:       string;
  data:      unknown;
  timestamp: number;
}

export interface WSFramePayload {
  event:      string;
  data:       unknown;
  receivedAt: number;
}

export interface OverlayUpdatePayload {
  itemId:           number;
  signal:           'bullish' | 'bearish' | 'neutral' | 'warning';
  label:            string;
  confidenceScore:  number;    // 0–1
  profitabilityPct: number;    // e.g. 14.2
}

export interface AlertPayload {
  id:       string;
  type:     'shortage' | 'spike' | 'opportunity' | 'oversaturation';
  title:    string;
  message:  string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface NotificationPayload {
  title: string;
  body:  string;
}

// Discriminated union for all messages
export type BackgroundMessage =
  | { type: MessageType.MARKET_DATA_INTERCEPTED; payload: MarketIngestPayload }
  | { type: MessageType.WS_FRAME_RECEIVED;       payload: WSFramePayload }
  | { type: MessageType.GET_CACHED_DATA;         payload: string }   // cache key
  | { type: MessageType.CLEAR_CACHE;             payload?: undefined }
  | { type: MessageType.DISPATCH_NOTIFICATION;   payload: NotificationPayload }
  | { type: MessageType.OVERLAY_UPDATE;          payload: OverlayUpdatePayload }
  | { type: MessageType.ALERT_TRIGGER;           payload: AlertPayload };

export interface BackgroundResponse {
  ok:     boolean;
  data?:  unknown;
  error?: string;
}

export interface CacheEntry {
  data:      unknown;
  cachedAt:  number;
  expiresAt: number;
  url:       string;
}
