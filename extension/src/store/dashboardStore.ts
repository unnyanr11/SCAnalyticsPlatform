import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  AIRecommendation,
  DashboardFilters,
  EconomyPhase,
  MarketRow,
  SortDir,
  SortKey,
  TrendingProduct,
  VolatilityEntry,
  WatchlistItem,
} from '../types/dashboard';
import { MOCK_MARKET, MOCK_TRENDING, MOCK_VOLATILITY, MOCK_RECS, CURRENT_PHASE } from '../utils/mockData';

interface DashboardState {
  // Data
  market: MarketRow[];
  trending: TrendingProduct[];
  volatility: VolatilityEntry[];
  recommendations: AIRecommendation[];
  phase: EconomyPhase;
  watchlist: WatchlistItem[];

  // Table UI
  sortKey: SortKey;
  sortDir: SortDir;
  filters: DashboardFilters;
  page: number;
  pageSize: number;

  // Active section
  activeSection: string;

  // Last tick timestamp
  lastTick: number;

  // Actions
  setSortKey: (key: SortKey) => void;
  toggleSortDir: () => void;
  setFilter: <K extends keyof DashboardFilters>(k: K, v: DashboardFilters[K]) => void;
  resetFilters: () => void;
  setPage: (n: number) => void;
  setActiveSection: (s: string) => void;
  toggleWatch: (id: number) => void;
  tickMarket: () => void;
  setPhase: (phase: EconomyPhase) => void;
}

const DEFAULT_FILTERS: DashboardFilters = {
  search: '',
  category: 'all',
  minProfit: 0,
  maxVolatility: 100,
  signalFilter: 'all',
};

export const useDashboardStore = create<DashboardState>()(
  immer((set) => ({
    market: MOCK_MARKET,
    trending: MOCK_TRENDING,
    volatility: MOCK_VOLATILITY,
    recommendations: MOCK_RECS,
    phase: CURRENT_PHASE,
    watchlist: [],
    sortKey: 'profitabilityScore',
    sortDir: 'desc',
    filters: DEFAULT_FILTERS,
    page: 0,
    pageSize: 12,
    activeSection: 'market',
    lastTick: Date.now(),

    setSortKey: (key) =>
      set((s) => {
        if (s.sortKey === key) s.sortDir = s.sortDir === 'asc' ? 'desc' : 'asc';
        else { s.sortKey = key; s.sortDir = 'desc'; }
        s.page = 0;
      }),

    toggleSortDir: () => set((s) => { s.sortDir = s.sortDir === 'asc' ? 'desc' : 'asc'; }),

    setFilter: (k, v) => set((s) => { s.filters[k] = v as never; s.page = 0; }),

    resetFilters: () => set((s) => { s.filters = DEFAULT_FILTERS; s.page = 0; }),

    setPage: (n) => set((s) => { s.page = n; }),

    setActiveSection: (section) => set((s) => { s.activeSection = section; }),

    toggleWatch: (id) =>
      set((s) => {
        const row = s.market.find((r) => r.id === id);
        if (!row) return;
        row.isWatched = !row.isWatched;
        if (row.isWatched) {
          s.watchlist.push({ productId: id, name: row.name, addedAt: new Date().toISOString() });
        } else {
          s.watchlist = s.watchlist.filter((w) => w.productId !== id);
        }
      }),

    tickMarket: () =>
      set((s) => {
        s.lastTick = Date.now();
        s.market.forEach((row) => {
          const jitter = (Math.random() - 0.5) * 0.006 * row.price;
          row.price = Math.max(0.01, +(row.price + jitter).toFixed(2));
          row.priceChange24h = +(row.priceChange24h + (Math.random() - 0.5) * 0.3).toFixed(2);
          row.demandScore = Math.min(100, Math.max(0, row.demandScore + (Math.random() - 0.5) * 2));
          row.sparkline = [...row.sparkline.slice(1), row.price];
          row.lastUpdated = new Date().toISOString();
        });
      }),

    setPhase: (phase) => set((s) => { s.phase = phase; }),
  }))
);
