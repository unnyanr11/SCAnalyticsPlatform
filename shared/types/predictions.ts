/**
 * shared/types/predictions.ts
 * TypeScript types for the AI analytics engine outputs:
 * profit predictions, production optimization, arbitrage,
 * shortage detection, and strategy recommendations.
 *
 * These types represent READ-ONLY analytical outputs.
 * No automation, no game interaction.
 */

import type { EconomyPhase, PriceDirection } from './market';

// ---------------------------------------------------------------------------
// Profit prediction
// ---------------------------------------------------------------------------

export type Recommendation = 'buy' | 'sell' | 'produce' | 'hold' | 'avoid';

export interface ProfitPrediction {
  productId: number;
  productName: string;
  recommendation: Recommendation;
  predictedMarginPct: number;
  predictedROI: number;
  confidenceScore: number;      // 0.0 – 1.0
  priceDirection: PriceDirection;
  reasoning: string;
  horizonHours: number;
  riskScore: number;            // 0.0 – 1.0
  expectedProfit?: number;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Shortage detection
// ---------------------------------------------------------------------------

export type ShortageSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ShortageAlert {
  productId: number;
  productName: string;
  severity: ShortageSeverity;
  confidenceScore: number;        // 0.0 – 1.0
  estimatedWindowHours: number;   // how soon shortage expected
  message: string;
  affectedIndustries: string[];
  indicators: {
    decliningInventory: boolean;
    abnormalBuyingActivity: boolean;
    priceSpike: boolean;
    supplyBottleneck: boolean;
  };
  detectedAt: string;
}

// ---------------------------------------------------------------------------
// Arbitrage opportunity
// ---------------------------------------------------------------------------

export interface ArbitrageOpportunity {
  productId: number;
  productName: string;
  currentPrice: number;
  historicalAverage: number;
  undervaluedByPct: number;
  estimatedProfitPct: number;
  opportunityScore: number;     // 0–100
  recoveryProbability: number;  // 0.0 – 1.0
  riskScore: number;            // 0.0 – 1.0
  estimatedDurationHours: number;
  message: string;
  detectedAt: string;
}

// ---------------------------------------------------------------------------
// Production optimizer
// ---------------------------------------------------------------------------

export interface ProductionStep {
  productId: number;
  productName: string;
  quantity: number;
  factoriesRequired: number;
  durationHours: number;
  resourcesNeeded: Array<{
    productId: number;
    productName: string;
    quantity: number;
    estimatedCost: number;
  }>;
}

export interface ProductionPlan {
  planId: string;
  targetProductId: number;
  targetProductName: string;
  steps: ProductionStep[];
  estimatedHourlyProfit: number;
  estimatedROI: number;
  totalCost: number;
  bottlenecks: string[];
  saturationWarnings: string[];
  competitionPressure: 'low' | 'medium' | 'high';
  generatedAt: string;
}

export interface ProductionOptimizerInput {
  playerLevel: number;
  availableCapital: number;
  factoryCount: number;
  workerCount: number;
  adminLevel: number;
  economyPhase: EconomyPhase;
  realm: number;
}

// ---------------------------------------------------------------------------
// Market heatmap
// ---------------------------------------------------------------------------

export type HeatmapIntensity = 'strong-buy' | 'buy' | 'neutral' | 'sell' | 'avoid';

export interface HeatmapCell {
  productId: number;
  productName: string;
  category: string;
  intensity: HeatmapIntensity;
  profitabilityScore: number;   // 0–100
  growthRate: number;           // % change
  volatilityScore: number;      // 0–100
  volume: number;
  price: number;
}

export interface MarketHeatmap {
  realm: number;
  cells: HeatmapCell[];
  economyPhase: EconomyPhase;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Economy strategy
// ---------------------------------------------------------------------------

export interface EconomyStrategy {
  phase: EconomyPhase;
  realm: number;
  summary: string;
  investmentStrategy: string;
  productionPriorities: string[];
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  inventoryRecommendation: string;
  avoidCategories: string[];
  focusCategories: string[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// AI assistant response
// ---------------------------------------------------------------------------

export interface AssistantResponse {
  query: string;
  answer: string;
  confidenceScore: number;   // 0.0 – 1.0
  dataPoints: Array<{
    label: string;
    value: string | number;
  }>;
  recommendation?: Recommendation;
  relatedProductIds: number[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

export interface PortfolioItem {
  productId: number;
  productName: string;
  quantity: number;
  averageCost: number;
  currentMarketPrice: number;
  unrealizedProfitPct: number;
  riskExposure: 'low' | 'medium' | 'high';
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  unrealizedProfit: number;
  unrealizedProfitPct: number;
  items: PortfolioItem[];
  riskDistribution: { low: number; medium: number; high: number };
  generatedAt: string;
}
