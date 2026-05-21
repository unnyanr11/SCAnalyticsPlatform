// ─── Overlay layer shared types ───────────────────────────────────────────
export type PageKind = 'market' | 'product' | 'production' | 'unknown';

export type MarketDirection =
  | 'strong_up'
  | 'up'
  | 'flat'
  | 'down'
  | 'strong_down';

export interface OverlayMetrics {
  productId: number;
  productName: string;
  /** 0–100 */
  profitabilityScore: number;
  /** 0–1 */
  aiConfidence: number;
  /** 0–1 */
  volatility: number;
  /** 0–1 */
  shortageRisk: number;
  direction: MarketDirection;
  /** % change over 24h */
  momentum24h: number;
  /** VWAP */
  currentPrice: number;
  updatedAt: number;
}

export interface OverlayHost {
  anchor: Element;
  shadow: ShadowRoot;
  reactRoot: import('react-dom/client').Root;
  productId: number;
  mountedAt: number;
}

export type OverlayVariant = 'badge' | 'panel';

/** Message sent from content script → overlay system when new data arrives */
export interface OverlayUpdateMessage {
  type: 'SCA_OVERLAY_UPDATE';
  metrics: OverlayMetrics;
}

export interface OverlayRemoveMessage {
  type: 'SCA_OVERLAY_REMOVE';
  productId: number;
}

export type OverlayMessage = OverlayUpdateMessage | OverlayRemoveMessage;
