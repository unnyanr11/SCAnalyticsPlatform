import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardStore } from '../store';
import { useSortedFilteredRows } from '../hooks/useSortedFilteredRows';
import type { SortKey, MarketRow } from '../types';

const SIGNAL_STYLE: Record<MarketRow['aiSignal'], string> = {
  strong_buy:  'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  buy:         'text-green-400 bg-green-500/10 border-green-500/25',
  hold:        'text-slate-400 bg-slate-500/10 border-slate-500/25',
  sell:        'text-orange-400 bg-orange-500/10 border-orange-500/25',
  strong_sell: 'text-red-400 bg-red-500/10 border-red-500/25',
};

const SIGNAL_LABEL: Record<MarketRow['aiSignal'], string> = {
  strong_buy:  '↑ Strong Buy',
  buy:         '↑ Buy',
  hold:        '— Hold',
  sell:        '↓ Sell',
  strong_sell: '↓ Strong Sell',
};

const CATEGORIES = [
  'all', 'Electronics', 'Materials', 'Chemicals',
  'Automotive', 'Agriculture', 'Research', 'Aerospace', 'Retail',
];

const COL: { key: SortKey; label: string; align?: string }[] = [
  { key: 'name',             label: 'Product',         align: 'text-left' },
  { key: 'vwap',             label: 'Price (VWAP)',    align: 'text-right' },
  { key: 'momentum24h',      label: 'Δ 24h',           align: 'text-right' },
  { key: 'demandScore',      label: 'Demand',          align: 'text-right' },
  { key: 'volatilityScore',  label: 'Volatility',      align: 'text-right' },
  { key: 'shortageRisk',     label: 'Shortage',        align: 'text-right' },
  { key: 'aiConfidence',     label: 'AI Signal',       align: 'text-center' },
];

const ScoreBar: React.FC<{ value: number; color?: string }> = ({ value, color = 'bg-sky-500' }) => (
  <div className="flex items-center gap-1.5">
    <div className="w-14 h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <motion.div
        className={`h-full ${color} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(value * 100)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
    <span className="tabular-nums text-xs w-8 text-slate-400">
      {Math.round(value * 100)}
    </span>
  </div>
);

export const LiveMarketTable: React.FC = () => {
  const {
    sort, setSort,
    search, setSearch,
    categoryFilter, setCategoryFilter,
    showWatchlistOnly, setShowWatchlistOnly,
    watchlist, toggleWatchlist,
  } = useDashboardStore();

  const rows = useSortedFilteredRows();

  const handleSort = useCallback((key: SortKey) => {
    setSort(
      sort.key === key
        ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'desc' },
    );
  }, [sort, setSort]);

  const sortIcon = (key: SortKey) => {
    if (sort.key !== key) return <span className="text-slate-600">⇅</span>;
    return <span className="text-sky-400">{sort.dir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-sky-500 cursor-pointer"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
          ))}
        </select>

        <button
          onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
            showWatchlistOnly
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
          }`}
        >
          ⭐ Watchlist {showWatchlistOnly ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700/60">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700">
              <th className="w-8 px-3 py-3" />
              {COL.map(({ key, label, align }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className={`px-3 py-3 font-medium text-slate-400 cursor-pointer select-none hover:text-slate-200 transition-colors whitespace-nowrap ${
                    align ?? 'text-left'
                  }`}
                >
                  <span className="flex items-center gap-1 ${ align === 'text-right' ? 'justify-end' : align === 'text-center' ? 'justify-center' : '' }">
                    {label} {sortIcon(key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {rows.map((row) => (
                <motion.tr
                  key={row.productId}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="border-b border-slate-700/40 hover:bg-slate-800/50 transition-colors group"
                >
                  {/* Watchlist star */}
                  <td className="px-3 py-3 w-8">
                    <button
                      onClick={() => toggleWatchlist(row.productId)}
                      className={`transition-all text-base ${
                        watchlist.has(row.productId)
                          ? 'text-amber-400 opacity-100'
                          : 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-400'
                      }`}
                      aria-label={watchlist.has(row.productId) ? 'Remove from watchlist' : 'Add to watchlist'}
                    >
                      ⭐
                    </button>
                  </td>

                  {/* Name */}
                  <td className="px-3 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-200">{row.name}</span>
                      <span className="text-xs text-slate-600">{row.category} · Q{row.quality}</span>
                    </div>
                  </td>

                  {/* VWAP */}
                  <td className="px-3 py-3 text-right">
                    <motion.span
                      key={row.vwap}
                      initial={{ color: '#f1f5f9' }}
                      animate={{ color: '#e2e8f0' }}
                      className="tabular-nums font-mono text-slate-200"
                    >
                      ${row.vwap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </motion.span>
                  </td>

                  {/* Momentum */}
                  <td className="px-3 py-3 text-right">
                    <span
                      className={`tabular-nums font-mono text-sm ${
                        row.momentum24h >= 0.05 ? 'text-emerald-400' :
                        row.momentum24h <= -0.05 ? 'text-red-400' : 'text-slate-400'
                      }`}
                    >
                      {row.momentum24h >= 0 ? '+' : ''}{(row.momentum24h * 100).toFixed(1)}%
                    </span>
                  </td>

                  {/* Demand */}
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end">
                      <ScoreBar value={row.demandScore} color="bg-sky-500" />
                    </div>
                  </td>

                  {/* Volatility */}
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end">
                      <ScoreBar
                        value={row.volatilityScore}
                        color={row.volatilityScore > 0.6 ? 'bg-red-500' : row.volatilityScore > 0.3 ? 'bg-amber-500' : 'bg-slate-500'}
                      />
                    </div>
                  </td>

                  {/* Shortage */}
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end">
                      <ScoreBar
                        value={row.shortageRisk}
                        color={row.shortageRisk > 0.7 ? 'bg-orange-500' : 'bg-slate-500'}
                      />
                    </div>
                  </td>

                  {/* AI Signal */}
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full border text-xs font-medium ${
                        SIGNAL_STYLE[row.aiSignal]
                      }`}
                    >
                      {SIGNAL_LABEL[row.aiSignal]}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="py-16 text-center text-slate-600 text-sm">
            No products match your filters.
          </div>
        )}
      </div>

      <div className="text-xs text-slate-600 text-right">
        {rows.length} of {useDashboardStore.getState().marketRows.length} products
      </div>
    </div>
  );
};
