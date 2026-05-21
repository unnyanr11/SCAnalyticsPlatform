/**
 * Overlay system shared types.
 * Kept framework-free so the content bridge can import without React.
 */

export type MarketDirection = 'strong_up' | 'up' | 'neutral' | 'down' | 'strong_down';

export type OverlaySignal = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';

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
  /** 0–1 */
  oversatRisk: number;
  marketDirection: MarketDirection;
  signal: OverlaySignal;
  expectedMarginPct: number;
  reasoning?: string;
  updatedAt: number; // ms timestamp
}

export type PageType = 'market' | 'product' | 'production' | 'unknown';

export interface PageContext {
  type: PageType;
  pathname: string;
  productId?: number;
  categorySlug?: string;
}
