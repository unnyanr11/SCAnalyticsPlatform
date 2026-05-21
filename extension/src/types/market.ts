/**
 * SC Analytics Platform — Market Domain Types (Extension)
 * Mirrors shared/types/market.ts — kept local for extension bundle independence.
 */

export type Realm = 0 | 1; // 0 = Americas, 1 = Europe

export interface MarketOffer {
  id:        number;
  kind:      number;       // resource ID
  quality:   number;       // 0–4
  price:     number;
  quantity:  number;
  seller:    string;
  postedAt:  string;       // ISO datetime
}

export interface ResourceInfo {
  id:           number;
  name:         string;
  kind:         string;
  db_letter:    string;
  image:        string;
  tier:         number;
  transport:    number;
  producedFrom: number[];  // resource IDs
}

export interface EconomyPhase {
  realm:      Realm;
  phase:      'boom' | 'stable' | 'recession' | 'recovery';
  startedAt:  string;
  trend:      'improving' | 'stable' | 'declining';
}

export interface MarketSnapshot {
  resourceId:   number;
  resourceName: string;
  realm:        Realm;
  timestamp:    number;
  minPrice:     number;
  maxPrice:     number;
  avgPrice:     number;
  totalVolume:  number;
  offerCount:   number;
  quality:      number;
}

export type Signal = 'bullish' | 'bearish' | 'neutral' | 'warning';

export interface AnalyticsSignal {
  resourceId:       number;
  signal:           Signal;
  label:            string;
  confidenceScore:  number;    // 0–1
  profitabilityPct: number;
  shortageRisk:     number;    // 0–1
  volatilityScore:  number;    // 0–1
  updatedAt:        number;
}
