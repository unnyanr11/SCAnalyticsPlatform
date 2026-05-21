import { useEffect, useRef } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import type { MarketRow, SortKey } from '../types/dashboard';

/** Auto-tick market data every 8 seconds to simulate realtime updates */
export function useRealtimeTick(intervalMs = 8_000) {
  const tick = useDashboardStore((s) => s.tickMarket);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ref.current = setInterval(tick, intervalMs);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [tick, intervalMs]);
}

/** Return sorted + filtered slice of market rows */
export function useFilteredMarket(): { rows: MarketRow[]; total: number; pageCount: number } {
  const { market, sortKey, sortDir, filters, page, pageSize } = useDashboardStore();

  const filtered = market.filter((r) => {
    if (filters.search && !r.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.category !== 'all' && r.category !== filters.category) return false;
    if (r.profitabilityScore < filters.minProfit) return false;
    if (r.volatilityScore > filters.maxVolatility) return false;
    if (filters.signalFilter !== 'all' && r.signal !== filters.signalFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey as SortKey];
    const bv = b[sortKey as SortKey];
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av;
    }
    return sortDir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  const total = sorted.length;
  const pageCount = Math.ceil(total / pageSize);
  const rows = sorted.slice(page * pageSize, (page + 1) * pageSize);
  return { rows, total, pageCount };
}
