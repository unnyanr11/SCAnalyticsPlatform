import { create } from 'zustand';
import type {
  MarketRow, SortState, EconomyPhaseData,
  AIRecommendation, VolatilityEntry, TrendingProduct, Realm,
} from './types';

interface DashboardState {
  // Realm
  realm: Realm;
  setRealm: (r: Realm) => void;

  // Market table
  marketRows: MarketRow[];
  setMarketRows: (rows: MarketRow[]) => void;
  upsertMarketRow: (row: MarketRow) => void;

  // Sort
  sort: SortState;
  setSort: (s: SortState) => void;

  // Search
  search: string;
  setSearch: (q: string) => void;

  // Watchlist
  watchlist: Set<number>;
  toggleWatchlist: (id: number) => void;

  // Filters
  categoryFilter: string;
  setCategoryFilter: (c: string) => void;
  showWatchlistOnly: boolean;
  setShowWatchlistOnly: (v: boolean) => void;

  // Economy phase
  phase: EconomyPhaseData | null;
  setPhase: (p: EconomyPhaseData) => void;

  // AI recommendations
  recommendations: AIRecommendation[];
  setRecommendations: (r: AIRecommendation[]) => void;

  // Volatility
  volatilityEntries: VolatilityEntry[];
  setVolatilityEntries: (v: VolatilityEntry[]) => void;

  // Trending
  trending: TrendingProduct[];
  setTrending: (t: TrendingProduct[]) => void;

  // Connection
  lastUpdated: Date | null;
  isConnected: boolean;
  setConnected: (v: boolean) => void;
  setLastUpdated: (d: Date) => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  realm: 0,
  setRealm: (realm) => set({ realm }),

  marketRows: [],
  setMarketRows: (marketRows) => set({ marketRows }),
  upsertMarketRow: (row) => set((s) => {
    const idx = s.marketRows.findIndex((r) => r.productId === row.productId);
    if (idx === -1) return { marketRows: [...s.marketRows, row] };
    const next = [...s.marketRows];
    next[idx] = row;
    return { marketRows: next };
  }),

  sort: { key: 'vwap', dir: 'desc' },
  setSort: (sort) => set({ sort }),

  search: '',
  setSearch: (search) => set({ search }),

  watchlist: new Set(),
  toggleWatchlist: (id) => set((s) => {
    const wl = new Set(s.watchlist);
    wl.has(id) ? wl.delete(id) : wl.add(id);
    return { watchlist: wl };
  }),

  categoryFilter: 'all',
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  showWatchlistOnly: false,
  setShowWatchlistOnly: (showWatchlistOnly) => set({ showWatchlistOnly }),

  phase: null,
  setPhase: (phase) => set({ phase }),

  recommendations: [],
  setRecommendations: (recommendations) => set({ recommendations }),

  volatilityEntries: [],
  setVolatilityEntries: (volatilityEntries) => set({ volatilityEntries }),

  trending: [],
  setTrending: (trending) => set({ trending }),

  lastUpdated: null,
  isConnected: false,
  setConnected: (isConnected) => set({ isConnected }),
  setLastUpdated: (lastUpdated) => set({ lastUpdated }),
}));
