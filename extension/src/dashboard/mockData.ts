import type {
  MarketRow, EconomyPhaseData, AIRecommendation,
  VolatilityEntry, TrendingProduct,
} from './types';

const rand = (min: number, max: number) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(4));

const history = () =>
  Array.from({ length: 24 }, () => rand(80, 200));

export const MOCK_MARKET_ROWS: MarketRow[] = [
  { productId: 1,  name: 'Processors',      category: 'Electronics',  quality: 1, vwap: 148.5,  lowestAsk: 143.2,  highestAsk: 155.0, totalSupply: 12400, demandScore: 0.87, volatilityScore: 0.62, momentum24h: 0.14,  priceHistory: history(), aiSignal: 'strong_buy',  aiConfidence: 0.91, shortageRisk: 0.73, oversatRisk: 0.08, source: 'simcotools', updatedAt: new Date().toISOString() },
  { productId: 2,  name: 'Steel',            category: 'Materials',    quality: 1, vwap: 34.2,   lowestAsk: 33.8,   highestAsk: 35.1,  totalSupply: 89200, demandScore: 0.55, volatilityScore: 0.28, momentum24h: -0.03, priceHistory: history(), aiSignal: 'hold',        aiConfidence: 0.68, shortageRisk: 0.12, oversatRisk: 0.41, source: 'simcotools', updatedAt: new Date().toISOString() },
  { productId: 3,  name: 'Batteries',        category: 'Electronics',  quality: 2, vwap: 82.1,   lowestAsk: 80.0,   highestAsk: 84.5,  totalSupply: 4300,  demandScore: 0.93, volatilityScore: 0.75, momentum24h: 0.22,  priceHistory: history(), aiSignal: 'strong_buy',  aiConfidence: 0.88, shortageRisk: 0.88, oversatRisk: 0.05, source: 'simcotools', updatedAt: new Date().toISOString() },
  { productId: 4,  name: 'Chemicals',        category: 'Chemicals',    quality: 1, vwap: 21.4,   lowestAsk: 20.9,   highestAsk: 22.0,  totalSupply: 55000, demandScore: 0.42, volatilityScore: 0.19, momentum24h: -0.08, priceHistory: history(), aiSignal: 'sell',        aiConfidence: 0.73, shortageRisk: 0.05, oversatRisk: 0.67, source: 'simcotools', updatedAt: new Date().toISOString() },
  { productId: 5,  name: 'Car Engine',       category: 'Automotive',   quality: 1, vwap: 310.0,  lowestAsk: 305.0,  highestAsk: 318.0, totalSupply: 2100,  demandScore: 0.78, volatilityScore: 0.44, momentum24h: 0.07,  priceHistory: history(), aiSignal: 'buy',         aiConfidence: 0.79, shortageRisk: 0.44, oversatRisk: 0.15, source: 'simcotools', updatedAt: new Date().toISOString() },
  { productId: 6,  name: 'Wheat',            category: 'Agriculture',  quality: 1, vwap: 8.4,    lowestAsk: 8.1,    highestAsk: 8.8,   totalSupply: 210000,demandScore: 0.31, volatilityScore: 0.11, momentum24h: -0.02, priceHistory: history(), aiSignal: 'hold',        aiConfidence: 0.55, shortageRisk: 0.04, oversatRisk: 0.55, source: 'simcotools', updatedAt: new Date().toISOString() },
  { productId: 7,  name: 'Solar Panels',     category: 'Research',     quality: 3, vwap: 620.0,  lowestAsk: 612.0,  highestAsk: 635.0, totalSupply: 800,   demandScore: 0.82, volatilityScore: 0.55, momentum24h: 0.11,  priceHistory: history(), aiSignal: 'buy',         aiConfidence: 0.83, shortageRisk: 0.61, oversatRisk: 0.09, source: 'simcotools', updatedAt: new Date().toISOString() },
  { productId: 8,  name: 'Plastic',          category: 'Materials',    quality: 1, vwap: 11.2,   lowestAsk: 10.9,   highestAsk: 11.6,  totalSupply: 143000,demandScore: 0.38, volatilityScore: 0.15, momentum24h: 0.01,  priceHistory: history(), aiSignal: 'hold',        aiConfidence: 0.60, shortageRisk: 0.07, oversatRisk: 0.48, source: 'simcotools', updatedAt: new Date().toISOString() },
  { productId: 9,  name: 'Rocket Fuel',      category: 'Aerospace',    quality: 2, vwap: 188.0,  lowestAsk: 183.0,  highestAsk: 195.0, totalSupply: 1200,  demandScore: 0.91, volatilityScore: 0.69, momentum24h: 0.18,  priceHistory: history(), aiSignal: 'strong_buy',  aiConfidence: 0.94, shortageRisk: 0.81, oversatRisk: 0.03, source: 'simcotools', updatedAt: new Date().toISOString() },
  { productId: 10, name: 'Retail Shops',     category: 'Retail',       quality: 1, vwap: 2400.0, lowestAsk: 2350.0, highestAsk: 2450.0,totalSupply: 320,   demandScore: 0.64, volatilityScore: 0.32, momentum24h: 0.04,  priceHistory: history(), aiSignal: 'hold',        aiConfidence: 0.70, shortageRisk: 0.22, oversatRisk: 0.28, source: 'simcotools', updatedAt: new Date().toISOString() },
];

export const MOCK_PHASE: EconomyPhaseData = {
  phase: 'boom',
  code: 1,
  label: 'Economic Boom',
  description: 'Consumer spending is elevated. Demand for manufactured goods and electronics is rising. Consider increasing production capacity and stocking high-margin goods.',
  updatedAt: new Date().toISOString(),
};

export const MOCK_RECOMMENDATIONS: AIRecommendation[] = [
  {
    id: 'rec_001', productId: 3, productName: 'Batteries',
    action: 'buy', confidence: 0.88, expectedMargin: 22.4,
    reasoning: 'Inventory declining 18% over 6h. Electronics demand surge detected. Shortage window estimated: 3–5 hours.',
    tags: ['shortage_incoming', 'high_demand', 'bullish'],
    generatedAt: new Date().toISOString(),
  },
  {
    id: 'rec_002', productId: 9, productName: 'Rocket Fuel',
    action: 'produce', confidence: 0.94, expectedMargin: 31.0,
    reasoning: 'Aerospace sector entering phase-driven boom. Supply critically low (1,200 units). 3 competitors offline. Margin exceptional.',
    tags: ['phase_boost', 'low_supply', 'produce_now'],
    generatedAt: new Date().toISOString(),
  },
  {
    id: 'rec_003', productId: 4, productName: 'Chemicals',
    action: 'sell', confidence: 0.73, expectedMargin: -8.2,
    reasoning: 'Oversaturation detected. 67% oversupply risk. Price declining for 12h. Recommend offloading excess inventory.',
    tags: ['oversaturated', 'bearish', 'reduce_exposure'],
    generatedAt: new Date().toISOString(),
  },
  {
    id: 'rec_004', productId: 1, productName: 'Processors',
    action: 'watch', confidence: 0.91, expectedMargin: 14.8,
    reasoning: 'Processors expected to rise 14% due to declining inventory and increased electronics demand. Momentum strong (+14% 24h).',
    tags: ['bullish_breakout', 'trending', 'shortage_risk'],
    generatedAt: new Date().toISOString(),
  },
];

export const MOCK_VOLATILITY: VolatilityEntry[] = MOCK_MARKET_ROWS.slice(0, 8).map((r) => ({
  productId: r.productId,
  name: r.name,
  category: r.category,
  score1h: rand(0.05, 0.9),
  score4h: rand(0.05, 0.9),
  score24h: r.volatilityScore,
  score7d: rand(0.05, 0.9),
  trend: r.momentum24h > 0.05 ? 'rising' : r.momentum24h < -0.05 ? 'falling' : 'stable',
  anomalyFlags: r.volatilityScore > 0.6 ? ['price_outlier'] : [],
}));

export const MOCK_TRENDING: TrendingProduct[] = [
  ...MOCK_MARKET_ROWS
    .sort((a, b) => Math.abs(b.momentum24h) - Math.abs(a.momentum24h))
    .slice(0, 6)
    .map((r, i) => ({
      productId: r.productId,
      name: r.name,
      category: r.category,
      changePercent24h: r.momentum24h * 100,
      currentPrice: r.vwap,
      priceHistory: r.priceHistory,
      momentum: r.momentum24h,
      rank: i + 1,
    })),
];
