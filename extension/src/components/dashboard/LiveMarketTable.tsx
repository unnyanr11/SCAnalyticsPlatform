import React, { useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardStore } from '../../store/dashboardStore';
import { useFilteredMarket } from '../../hooks/useDashboardData';
import type { MarketRow, SortKey } from '../../types/dashboard';
import MiniSparkline from './MiniSparkline';

const CATEGORIES = ['all', 'Electronics', 'Agriculture', 'Chemicals', 'Automotive', 'Aerospace', 'Retail', 'Research'];

const SIGNAL_COLORS: Record<string, string> = {
  '↑ Strong Buy':       'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  '↓ Oversaturated':    'bg-red-500/15 text-red-400 border-red-500/30',
  '🔥 High Profit':     'bg-orange-500/15 text-orange-400 border-orange-500/30',
  '⚠ Shortage Incoming':'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  '📈 Bullish Trend':   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  '📉 Bearish Trend':   'bg-rose-500/15 text-rose-400 border-rose-500/30',
  '🔄 Neutral':         'bg-sc-surface-offset text-sc-text-muted border-sc-border',
};

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span className="text-sc-text-faint ml-1">↕</span>;
  return <span className="text-sc-accent ml-1">{dir === 'asc' ? '↑' : '↓'}</span>;
}

const COLS: Array<{ key: SortKey; label: string; align?: string }> = [
  { key: 'name',              label: 'Product' },
  { key: 'price',             label: 'Price',       align: 'right' },
  { key: 'priceChange24h',    label: '24h %',       align: 'right' },
  { key: 'profitabilityScore',label: 'Profit',      align: 'right' },
  { key: 'demandScore',       label: 'Demand',      align: 'right' },
  { key: 'volatilityScore',   label: 'Volatility',  align: 'right' },
  { key: 'signal',            label: 'Signal',      align: 'center' },
  { key: 'confidence',        label: 'AI Conf.',    align: 'right' },
];

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-sc-border rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      <span className="tabular-nums text-xs">{Math.round(value)}</span>
    </div>
  );
}

export default function LiveMarketTable() {
  const { setSortKey, setFilter, resetFilters, setPage, toggleWatch } = useDashboardStore();
  const { sortKey, sortDir, filters, page, pageSize } = useDashboardStore();
  const { rows, total, pageCount } = useFilteredMarket();
  const prevPrices = useRef<Record<number, number>>({});

  const getFlash = useCallback((row: MarketRow) => {
    const prev = prevPrices.current[row.id];
    if (prev === undefined) { prevPrices.current[row.id] = row.price; return ''; }
    const flash = row.price > prev ? 'flash-green' : row.price < prev ? 'flash-red' : '';
    prevPrices.current[row.id] = row.price;
    return flash;
  }, []);

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search products…"
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg bg-sc-surface border border-sc-border text-sm text-sc-text placeholder-sc-text-faint focus:outline-none focus:border-sc-accent transition-colors"
        />
        <select
          value={filters.category}
          onChange={(e) => setFilter('category', e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-sc-surface border border-sc-border text-sm text-sc-text focus:outline-none focus:border-sc-accent"
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-sc-text-faint">Min profit</span>
          <input
            type="range" min="0" max="100" step="5"
            value={filters.minProfit}
            onChange={(e) => setFilter('minProfit', +e.target.value)}
            className="w-20 accent-sc-accent"
          />
          <span className="text-xs tabular-nums w-6 text-sc-text-muted">{filters.minProfit}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-sc-text-faint">Max vol.</span>
          <input
            type="range" min="0" max="100" step="5"
            value={filters.maxVolatility}
            onChange={(e) => setFilter('maxVolatility', +e.target.value)}
            className="w-20 accent-sc-accent"
          />
          <span className="text-xs tabular-nums w-6 text-sc-text-muted">{filters.maxVolatility}</span>
        </div>
        <button
          onClick={resetFilters}
          className="px-3 py-1.5 text-xs rounded-lg border border-sc-border text-sc-text-muted hover:text-sc-text hover:border-sc-accent transition-colors"
        >
          Reset
        </button>
        <span className="ml-auto text-xs text-sc-text-faint tabular-nums">{total} products</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-sc-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sc-surface-offset">
                <th className="w-10 px-3 py-2.5" />
                {COLS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => setSortKey(col.key)}
                    className={`px-3 py-2.5 text-${col.align ?? 'left'} text-xs font-medium text-sc-text-muted uppercase tracking-wide cursor-pointer select-none hover:text-sc-text transition-colors whitespace-nowrap`}
                  >
                    {col.label}
                    <SortIcon active={sortKey === col.key} dir={sortDir} />
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-xs font-medium text-sc-text-muted uppercase tracking-wide">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sc-border">
              <AnimatePresence initial={false}>
                {rows.map((row) => (
                  <motion.tr
                    key={row.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`bg-sc-surface hover:bg-sc-surface-offset transition-colors ${getFlash(row)}`}
                  >
                    {/* Watch toggle */}
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => toggleWatch(row.id)}
                        title={row.isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
                        className={`text-base transition-colors ${ row.isWatched ? 'text-sc-accent' : 'text-sc-text-faint hover:text-sc-text-muted' }`}
                      >
                        {row.isWatched ? '★' : '☆'}
                      </button>
                    </td>
                    {/* Name */}
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-sc-text">{row.name}</div>
                      <div className="text-xs text-sc-text-faint">{row.category}</div>
                    </td>
                    {/* Price */}
                    <td className="px-3 py-2.5 text-right tabular-nums font-mono text-sc-text">
                      ${row.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {/* 24h change */}
                    <td className={`px-3 py-2.5 text-right tabular-nums font-mono text-sm ${ row.priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400' }`}>
                      {row.priceChange24h >= 0 ? '+' : ''}{row.priceChange24h.toFixed(2)}%
                    </td>
                    {/* Profitability */}
                    <td className="px-3 py-2.5 text-right">
                      <ScoreBar value={row.profitabilityScore} color="bg-emerald-500" />
                    </td>
                    {/* Demand */}
                    <td className="px-3 py-2.5 text-right">
                      <ScoreBar value={row.demandScore} color="bg-blue-500" />
                    </td>
                    {/* Volatility */}
                    <td className="px-3 py-2.5 text-right">
                      <ScoreBar value={row.volatilityScore} color={row.volatilityScore > 65 ? 'bg-red-500' : 'bg-yellow-500'} />
                    </td>
                    {/* Signal */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${SIGNAL_COLORS[row.signal] ?? ''}`}>
                        {row.signal}
                      </span>
                    </td>
                    {/* Confidence */}
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs text-sc-text-muted">
                      {Math.round(row.confidence)}%
                    </td>
                    {/* Sparkline */}
                    <td className="px-3 py-2.5">
                      <MiniSparkline data={row.sparkline} positive={row.priceChange24h >= 0} />
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-sc-text-faint">
            Page {page + 1} of {pageCount}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 text-xs rounded-lg border border-sc-border disabled:opacity-30 hover:bg-sc-surface-offset transition-colors"
            >← Prev</button>
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-7 h-7 text-xs rounded-lg border transition-colors ${
                  i === page
                    ? 'bg-sc-accent/20 border-sc-accent text-sc-accent'
                    : 'border-sc-border hover:bg-sc-surface-offset'
                }`}
              >{i + 1}</button>
            ))}
            <button
              disabled={page === pageCount - 1}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 text-xs rounded-lg border border-sc-border disabled:opacity-30 hover:bg-sc-surface-offset transition-colors"
            >Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
