// ─── Shared dashboard types ───────────────────────────────────────────────
export type Realm = 0 | 1;

export type EconomyPhase = 'boom' | 'stable' | 'recession' | 'recovery';

export interface EconomyPhaseData {
  phase: EconomyPhase;
  code: number;
  label: string;
  description: string;
  updatedAt: string;
}

export interface MarketRow {
  productId: number;
  name: string;
  category: string;
  quality: number;
  vwap: number;
  lowestAsk: number;
  highestAsk: number;
  totalSupply: number;
  demandScore: number;
  volatilityScore: number;
  momentum24h: number;
  priceHistory: number[];   // last 24 data points for sparkline
  aiSignal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  aiConfidence: number;     // 0–1
  shortageRisk: number;     // 0–1
  oversatRisk: number;      // 0–1
  source: string;
  updatedAt: string;
}

export type SortKey = keyof Pick<
  MarketRow,
  'name' | 'vwap' | 'demandScore' | 'volatilityScore' | 'momentum24h' | 'shortageRisk' | 'aiConfidence'
>;

export type SortDir = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  dir: SortDir;
}

export interface AIRecommendation {
  id: string;
  productId: number;
  productName: string;
  action: 'buy' | 'sell' | 'produce' | 'hold' | 'watch';
  confidence: number;
  expectedMargin: number;   // %
  reasoning: string;
  tags: string[];
  generatedAt: string;
}

export interface VolatilityEntry {
  productId: number;
  name: string;
  category: string;
  score1h: number;
  score4h: number;
  score24h: number;
  score7d: number;
  trend: 'rising' | 'falling' | 'stable';
  anomalyFlags: string[];
}

export interface TrendingProduct {
  productId: number;
  name: string;
  category: string;
  changePercent24h: number;
  currentPrice: number;
  priceHistory: number[];
  momentum: number;
  rank: number;
}
