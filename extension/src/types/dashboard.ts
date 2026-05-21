// ─── Core domain types for the Market Intelligence Dashboard ───────────────

export type Realm = 0 | 1;

export type PriceDirection = 'up' | 'down' | 'neutral';
export type SignalLabel =
  | '↑ Strong Buy'
  | '↓ Oversaturated'
  | '🔥 High Profit'
  | '⚠ Shortage Incoming'
  | '📈 Bullish Trend'
  | '📉 Bearish Trend'
  | '🔄 Neutral';

export type EconomyPhaseCode = 'boom' | 'stable' | 'recession' | 'recovery';

export interface MarketRow {
  id: number;
  name: string;
  category: string;
  price: number;
  priceChange24h: number;    // percent
  supply: number;
  demandScore: number;       // 0–100
  volatilityScore: number;   // 0–100
  profitabilityScore: number;// 0–100
  shortageRisk: number;      // 0–100
  signal: SignalLabel;
  confidence: number;        // 0–100
  quality: number;           // 1–5
  lastUpdated: string;       // ISO
  isWatched: boolean;
  sparkline: number[];       // last 24 data pts
}

export interface TrendingProduct {
  id: number;
  name: string;
  category: string;
  rank: number;
  priceNow: number;
  price24hAgo: number;
  changePercent: number;
  momentum: 'rising' | 'falling' | 'stable';
  volume24h: number;
  sparkline: number[];
}

export interface VolatilityEntry {
  productId: number;
  name: string;
  category: string;
  volatility1h: number;
  volatility24h: number;
  volatility7d: number;
  stdDev: number;
  rsi: number;
  anomalyScore: number;
  flags: string[];
}

export interface AIRecommendation {
  id: string;
  productId: number;
  productName: string;
  action: 'BUY' | 'SELL' | 'PRODUCE' | 'HOLD' | 'WATCH';
  confidence: number;        // 0–100
  predictedMargin: number;   // percent
  roi: number;               // percent
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reasoning: string;
  validUntil: string;        // ISO
  tags: string[];
}

export interface EconomyPhase {
  code: EconomyPhaseCode;
  label: string;
  emoji: string;
  description: string;
  strategies: string[];
  color: string;             // Tailwind color token name
  sinceTimestamp: string;    // ISO
  confidence: number;
}

export interface WatchlistItem {
  productId: number;
  name: string;
  addedAt: string;
  alertThreshold?: number;
}

export type SortKey = keyof MarketRow;
export type SortDir = 'asc' | 'desc';

export interface DashboardFilters {
  search: string;
  category: string;
  minProfit: number;
  maxVolatility: number;
  signalFilter: SignalLabel | 'all';
}
