import type {
  AIRecommendation,
  EconomyPhase,
  MarketRow,
  TrendingProduct,
  VolatilityEntry,
} from '../types/dashboard';

const rnd = (min: number, max: number) => +(Math.random() * (max - min) + min).toFixed(2);
const spark = (base: number) => Array.from({ length: 24 }, (_, i) => +(base + Math.sin(i / 3) * base * 0.08 + rnd(-base * 0.03, base * 0.03)).toFixed(2));

const CATEGORIES = ['Electronics', 'Agriculture', 'Chemicals', 'Automotive', 'Aerospace', 'Retail', 'Research'];
const SIGNALS = [
  '↑ Strong Buy', '↓ Oversaturated', '🔥 High Profit',
  '⚠ Shortage Incoming', '📈 Bullish Trend', '📉 Bearish Trend', '🔄 Neutral',
] as const;

const PRODUCTS = [
  { id: 1,  name: 'Processors',      cat: 'Electronics'  },
  { id: 2,  name: 'Steel',           cat: 'Chemicals'     },
  { id: 3,  name: 'Batteries',       cat: 'Electronics'   },
  { id: 4,  name: 'Wheat',           cat: 'Agriculture'   },
  { id: 5,  name: 'Carbon Fiber',    cat: 'Aerospace'     },
  { id: 6,  name: 'Solar Panels',    cat: 'Electronics'   },
  { id: 7,  name: 'Rubber',          cat: 'Automotive'    },
  { id: 8,  name: 'Microchips',      cat: 'Electronics'   },
  { id: 9,  name: 'Jet Fuel',        cat: 'Aerospace'     },
  { id: 10, name: 'Plastic',         cat: 'Chemicals'     },
  { id: 11, name: 'Aluminium',       cat: 'Automotive'    },
  { id: 12, name: 'Research Papers', cat: 'Research'      },
  { id: 13, name: 'Coffee Beans',    cat: 'Agriculture'   },
  { id: 14, name: 'Luxury Cars',     cat: 'Automotive'    },
  { id: 15, name: 'Fertilizer',      cat: 'Agriculture'   },
  { id: 16, name: 'Server Racks',    cat: 'Electronics'   },
  { id: 17, name: 'Aviation Parts',  cat: 'Aerospace'     },
  { id: 18, name: 'Glass',           cat: 'Retail'        },
  { id: 19, name: 'Semiconductors',  cat: 'Electronics'   },
  { id: 20, name: 'Crude Oil',       cat: 'Chemicals'     },
];

export const MOCK_MARKET: MarketRow[] = PRODUCTS.map((p) => {
  const price = rnd(10, 2000);
  return {
    id: p.id,
    name: p.name,
    category: p.cat,
    price,
    priceChange24h: rnd(-15, 22),
    supply: rnd(500, 50000),
    demandScore: rnd(20, 95),
    volatilityScore: rnd(5, 85),
    profitabilityScore: rnd(15, 98),
    shortageRisk: rnd(0, 80),
    signal: SIGNALS[Math.floor(Math.random() * SIGNALS.length)],
    confidence: rnd(55, 97),
    quality: Math.ceil(Math.random() * 5),
    lastUpdated: new Date().toISOString(),
    isWatched: false,
    sparkline: spark(price),
  };
});

export const MOCK_TRENDING: TrendingProduct[] = PRODUCTS.slice(0, 8).map((p, i) => {
  const now = rnd(50, 1800);
  const ago = now * (1 + rnd(-0.15, 0.2));
  return {
    id: p.id,
    name: p.name,
    category: p.cat,
    rank: i + 1,
    priceNow: now,
    price24hAgo: ago,
    changePercent: +((now - ago) / ago * 100).toFixed(2),
    momentum: now > ago ? 'rising' : now < ago ? 'falling' : 'stable',
    volume24h: rnd(1000, 200000),
    sparkline: spark(now),
  };
});

export const MOCK_VOLATILITY: VolatilityEntry[] = PRODUCTS.slice(0, 10).map((p) => ({
  productId: p.id,
  name: p.name,
  category: p.cat,
  volatility1h: rnd(0, 40),
  volatility24h: rnd(0, 65),
  volatility7d: rnd(0, 80),
  stdDev: rnd(1, 120),
  rsi: rnd(25, 75),
  anomalyScore: rnd(0, 1),
  flags: Math.random() > 0.6 ? ['high_volatility'] : [],
}));

export const MOCK_RECS: AIRecommendation[] = [
  { id: 'r1', productId: 1, productName: 'Processors', action: 'BUY', confidence: 88, predictedMargin: 14.2, roi: 22.1, riskLevel: 'LOW', reasoning: 'Processors expected to rise 14% due to declining inventory and increased electronics demand. RSI at 38 signals oversold conditions.', validUntil: new Date(Date.now() + 3_600_000 * 4).toISOString(), tags: ['shortage', 'bullish', 'electronics'] },
  { id: 'r2', productId: 3, productName: 'Batteries', action: 'PRODUCE', confidence: 81, predictedMargin: 18.7, roi: 31.4, riskLevel: 'LOW', reasoning: 'Battery demand surging across automotive and electronics. Production margins at 18.7% — well above 7d average.', validUntil: new Date(Date.now() + 3_600_000 * 6).toISOString(), tags: ['produce', 'high-margin', 'trending'] },
  { id: 'r3', productId: 20, productName: 'Crude Oil', action: 'SELL', confidence: 74, predictedMargin: -8.3, roi: -4.1, riskLevel: 'HIGH', reasoning: 'Economy entering recession phase. Crude Oil oversaturated with 47% above 30d supply average. Sell before further decline.', validUntil: new Date(Date.now() + 3_600_000 * 2).toISOString(), tags: ['oversaturated', 'bearish', 'recession'] },
  { id: 'r4', productId: 5, productName: 'Carbon Fiber', action: 'WATCH', confidence: 67, predictedMargin: 9.1, roi: 12.8, riskLevel: 'MEDIUM', reasoning: 'Aerospace recovery pending. Monitor for breakout above historical average price.', validUntil: new Date(Date.now() + 3_600_000 * 8).toISOString(), tags: ['watch', 'aerospace', 'recovery'] },
  { id: 'r5', productId: 8, productName: 'Microchips', action: 'HOLD', confidence: 79, predictedMargin: 6.2, roi: 9.0, riskLevel: 'LOW', reasoning: 'Microchips consolidating after recent spike. Hold current inventory — further upside expected in 6–12 hours.', validUntil: new Date(Date.now() + 3_600_000 * 10).toISOString(), tags: ['hold', 'consolidation', 'electronics'] },
];

export const CURRENT_PHASE: EconomyPhase = {
  code: 'stable',
  label: 'Stable Economy',
  emoji: '⚖',
  description: 'Market in balanced growth. Moderate risk tolerance appropriate. Focus on high-margin products.',
  strategies: [
    'Invest in high-margin electronics and aerospace',
    'Maintain diversified production portfolio',
    'Monitor for early boom signals in tech sector',
    'Build inventory buffers for shortage-prone items',
    'Avoid oversaturated agricultural commodities',
  ],
  color: 'blue',
  sinceTimestamp: new Date(Date.now() - 3_600_000 * 18).toISOString(),
  confidence: 82,
};

export const ALL_PHASES: EconomyPhase[] = [
  CURRENT_PHASE,
  { code: 'boom', label: 'Boom', emoji: '🚀', description: 'Aggressive growth. High demand across all sectors. Maximize production and market participation.', strategies: ['Maximize production capacity', 'Invest heavily in high-ROI products', 'Stock up before prices peak', 'Take calculated risks on volatile assets', 'Expand factory capacity now'], color: 'green', sinceTimestamp: '', confidence: 0 },
  { code: 'recession', label: 'Recession', emoji: '📉', description: 'Economy contracting. Reduce volatile exposure. Focus on essential consumer goods.', strategies: ['Cut production of luxury/volatile items', 'Prioritize essential consumer goods', 'Hold cash reserves', 'Avoid large inventory builds', 'Watch for recovery signals'], color: 'red', sinceTimestamp: '', confidence: 0 },
  { code: 'recovery', label: 'Recovery', emoji: '🌱', description: 'Economy recovering from recession. Carefully re-enter growth positions.', strategies: ['Gradually increase production', 'Target undersupplied products first', 'Rebuild inventory positions slowly', 'Monitor volume indicators for confirmation', 'Prepare for boom phase transition'], color: 'yellow', sinceTimestamp: '', confidence: 0 },
];
