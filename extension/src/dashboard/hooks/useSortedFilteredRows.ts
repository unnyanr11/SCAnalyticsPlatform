import { useMemo } from 'react';
import { useDashboardStore } from '../store';
import type { MarketRow } from '../types';

export function useSortedFilteredRows(): MarketRow[] {
  const {
    marketRows, sort, search,
    categoryFilter, showWatchlistOnly, watchlist,
  } = useDashboardStore();

  return useMemo(() => {
    let rows = [...marketRows];

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q),
      );
    }
    if (categoryFilter !== 'all') {
      rows = rows.filter((r) => r.category === categoryFilter);
    }
    if (showWatchlistOnly) {
      rows = rows.filter((r) => watchlist.has(r.productId));
    }

    rows.sort((a, b) => {
      const av = a[sort.key] as number | string;
      const bv = b[sort.key] as number | string;
      if (typeof av === 'string' && typeof bv === 'string') {
        return sort.dir === 'asc'
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      const an = av as number;
      const bn = bv as number;
      return sort.dir === 'asc' ? an - bn : bn - an;
    });

    return rows;
  }, [marketRows, sort, search, categoryFilter, showWatchlistOnly, watchlist]);
}
