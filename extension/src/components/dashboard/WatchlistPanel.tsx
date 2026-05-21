import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardStore } from '../../store/dashboardStore';

export default function WatchlistPanel() {
  const watchlist = useDashboardStore((s) => s.watchlist);
  const market = useDashboardStore((s) => s.market);
  const toggleWatch = useDashboardStore((s) => s.toggleWatch);

  const watched = watchlist
    .map((w) => ({ ...w, row: market.find((r) => r.id === w.productId) }))
    .filter((w) => w.row);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-sc-text">Watchlist</h2>
        <span className="text-xs text-sc-text-faint">{watched.length} items</span>
      </div>

      {watched.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center py-16 text-sc-text-faint"
        >
          <span className="text-4xl mb-3">☆</span>
          <p className="text-sm font-medium text-sc-text-muted">No products watched yet</p>
          <p className="text-xs mt-1">Click the ★ icon in the market table to add products here.</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {watched.map(({ productId, row, addedAt }) => (
              <motion.div
                key={productId}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-sc-surface border border-sc-border rounded-xl p-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sc-text">{row!.name}</span>
                    <span className="text-xs text-sc-text-faint">{row!.category}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="tabular-nums font-mono text-sm text-sc-text">
                      ${row!.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`text-xs tabular-nums ${ row!.priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400' }`}>
                      {row!.priceChange24h >= 0 ? '+' : ''}{row!.priceChange24h.toFixed(2)}%
                    </span>
                    <span className="text-xs text-sc-text-faint ml-auto">
                      Added {new Date(addedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="px-2 py-0.5 rounded-full text-xs border bg-sc-surface-offset text-sc-text-muted border-sc-border">
                    {row!.signal}
                  </span>
                  <button
                    onClick={() => toggleWatch(productId)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
