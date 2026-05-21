import React from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, LineChart, Line, Tooltip,
} from 'recharts';
import { useDashboardStore } from '../store';

export const TrendingProducts: React.FC = () => {
  const { trending } = useDashboardStore();

  if (!trending.length) {
    return (
      <div className="py-10 text-center text-slate-600 text-sm">
        Loading trending data…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {trending.map((t, i) => (
        <motion.div
          key={t.productId}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col gap-2 hover:border-slate-600 transition-colors"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600">#{t.rank}</span>
                <span className="text-sm font-semibold text-slate-200">{t.name}</span>
              </div>
              <span className="text-xs text-slate-600">{t.category}</span>
            </div>
            <span
              className={`text-sm font-bold tabular-nums ${
                t.changePercent24h >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {t.changePercent24h >= 0 ? '+' : ''}{t.changePercent24h.toFixed(1)}%
            </span>
          </div>

          {/* Price */}
          <div className="text-xs text-slate-500">
            <span className="text-slate-300 font-mono tabular-nums">
              ${t.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {' '}VWAP
          </div>

          {/* Sparkline */}
          <div className="h-12">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={t.priceHistory.map((v, idx) => ({ v, idx }))}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={t.changePercent24h >= 0 ? '#34d399' : '#f87171'}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300">
                        ${Number(payload[0].value).toFixed(2)}
                      </div>
                    ) : null
                  }
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
