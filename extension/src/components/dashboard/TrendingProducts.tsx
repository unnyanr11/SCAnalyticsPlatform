import React from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { useDashboardStore } from '../../store/dashboardStore';

const rankColors = ['#f59e0b', '#94a3b8', '#b45309'];

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] } }),
};

export default function TrendingProducts() {
  const trending = useDashboardStore((s) => s.trending);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-sc-text">Trending Products — 24h</h2>
        <span className="text-xs text-sc-text-faint">Sorted by momentum</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {trending.map((p, i) => {
          const chartData = p.sparkline.map((v, j) => ({ t: j, v }));
          const isUp = p.changePercent >= 0;
          return (
            <motion.div
              key={p.id}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="bg-sc-surface border border-sc-border rounded-xl p-4 hover:border-sc-accent/40 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: rankColors[i] ?? '#64748b', color: '#0f172a' }}
                    >
                      {p.rank}
                    </span>
                    <span className="font-semibold text-sc-text text-sm">{p.name}</span>
                  </div>
                  <span className="text-xs text-sc-text-faint ml-7">{p.category}</span>
                </div>
                <span className={`text-sm font-mono font-semibold ${ isUp ? 'text-emerald-400' : 'text-red-400' }`}>
                  {isUp ? '+' : ''}{p.changePercent.toFixed(2)}%
                </span>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-lg font-mono font-bold text-sc-text tabular-nums">
                  ${p.priceNow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-sc-text-faint line-through tabular-nums">
                  ${p.price24hAgo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Momentum badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 rounded-full text-xs border ${
                  p.momentum === 'rising'  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  p.momentum === 'falling' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  'bg-sc-surface-offset text-sc-text-faint border-sc-border'
                }`}>
                  {p.momentum === 'rising' ? '▲ Rising' : p.momentum === 'falling' ? '▼ Falling' : '→ Stable'}
                </span>
                <span className="text-xs text-sc-text-faint tabular-nums">
                  Vol {(p.volume24h / 1000).toFixed(1)}k
                </span>
              </div>

              {/* Recharts area sparkline */}
              <div className="h-14 -mx-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={`sg-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isUp ? '#10b981' : '#f87171'} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={isUp ? '#10b981' : '#f87171'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis domain={['dataMin', 'dataMax']} hide />
                    <Tooltip
                      contentStyle={{ background: '#1e2230', border: '1px solid #2d3250', borderRadius: 6, fontSize: 11 }}
                      formatter={(v: number) => [`$${v.toFixed(2)}`, 'Price']}
                      labelFormatter={() => ''}
                    />
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={isUp ? '#10b981' : '#f87171'}
                      strokeWidth={1.5}
                      fill={`url(#sg-${p.id})`}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
