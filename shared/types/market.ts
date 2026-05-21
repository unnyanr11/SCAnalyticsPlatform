/**
 * shared/types/market.ts
 * Shared TypeScript types for the SC Analytics Platform.
 * Used by the browser extension. Mirror of backend Pydantic schemas.
 *
 * IMPORTANT: This file must NEVER contain any automation logic.
 * It is strictly a type contract for analytics, forecasting,
 * and decision-support data structures.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export type EconomyPhase = 'boom' | 'stable' | 'recession' | 'recovery';

export type PriceDirection = 'up' | 'down' | 'stable';

export type DemandTrend = 'rising' | 'falling' | 'stable';

export type BadgeType =
  | 'bullish'
  | 'bearish'
  | 'warning'
  | 'danger'
  | 'volatile'
  | 'neutral';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type Realm = 0 | 1; // 0 = Alpha, 1 = Beta

// ---------------------------------------------------------------------------
// Products / Resources
// ---------------------------------------------------------------------------

export interface Product {
  id: number;
  name: string;
  category?: string;
  imageUrl?: string;
  retailPrice?: number;
  productionCost?: number;
  realm: Realm;
}

// ---------------------------------------------------------------------------
// Market data
// ---------------------------------------------------------------------------

export interface MarketPrice {
  id: number;
  productId: number;
  price: number;
  quantity: number;
  realm: Realm;
  source?: string;
  recordedAt: string; // ISO-8601
}

export interface MarketSnapshot {
  productId: number;
  productName: string;
  currentPrice: number;
  quantity: number;
  retailPrice?: number;
  productionCost?: number;
  realm: Realm;
  source: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// AI predictions
// ---------------------------------------------------------------------------

export interface AIPrediction {
  id: string; // UUID
  productId: number;
  modelType: string;
  predictedPrice?: number;
  predictedMarginPct?: number;
  confidence?: number;         // 0.0 – 1.0
  direction?: PriceDirection;
  reasoning?: string;
  shortageProb?: number;
  oversaturationRisk?: number;
  horizonHours: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Scoring (overlay badges)
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  profitability: number;       // 0–100
  volatility: number;          // 0–100
  priceDirection: PriceDirection;
  demandTrend: DemandTrend;
  shortage: number;            // 0–100
  oversaturation: number;      // 0–100
  confidence: number;          // 0–100
}

export interface BadgeLabel {
  icon: string;
  text: string;
  type: BadgeType;
}

export interface ScoredItem {
  id: number;
  name: string;
  price?: number;
  quantity?: number;
  scores: ScoreBreakdown;
  label: BadgeLabel;
  economyPhase?: EconomyPhase;
  source?: string;
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// Economy phase
// ---------------------------------------------------------------------------

export interface EconomyPhaseRecord {
  id: number;
  realm: Realm;
  phase: EconomyPhase;
  recordedAt: string;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export interface Alert {
  id: string; // UUID
  productId?: number;
  alertType: string;
  severity: AlertSeverity;
  message: string;
  confidence?: number;
  isRead: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Paginated responses
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginatedAlerts {
  items: Alert[];
  total: number;
  unread: number;
}

// ---------------------------------------------------------------------------
// API interception payload
// ---------------------------------------------------------------------------

/**
 * Represents an intercepted API call from the SimCompanies game.
 * The extension monitors network traffic and extracts these payloads
 * for analysis — it NEVER modifies or initiates any game API calls.
 */
export interface InterceptedPayload {
  url: string;
  method: 'GET' | 'POST';
  status: number;
  data: unknown;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Extension state
// ---------------------------------------------------------------------------

export interface ExtensionSettings {
  enabled: boolean;
  overlaysEnabled: boolean;
  alertsEnabled: boolean;
  notificationsEnabled: boolean;
  pollingIntervalMs: number;   // default 30000
  realm: Realm;
  theme: 'dark' | 'light';
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  overlaysEnabled: true,
  alertsEnabled: true,
  notificationsEnabled: true,
  pollingIntervalMs: 30_000,
  realm: 0,
  theme: 'dark',
};
