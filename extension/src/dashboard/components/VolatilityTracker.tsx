import React from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, Tooltip,
} from 'recharts';
import { useDashboardStore } from '../store';

const VolBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const color =
    value >= 0.7 ? 'bg-red-500 shadow-[0_0_8px_#ef444455]' :
    value >= 0.4 ? 'bg-amber-500' :
    'bg-slate-600';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-600 w-6 text-right tabular-nums">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${color} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(value * 100)}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs tabular-nums text-slate-400 w-7 text-right">
        {Math.round(value * 100)}
      </span>
    </div>
  );
};

export const VolatilityTracker: React.FC = () => {
  const { volatilityEntries } = useDashboardStore();

  const top = volatilityEntries
    .sort((a, b) => b.score24h - a.score24h)
    .slice(0, 6);

  const radarData = top.map((e) => ({
    subject: e.name.length > 10 ? e.name.slice(0, 9) + '…' : e.name,
    '1h':  Math.round(e.score1h * 100),
    '24h': Math.round(e.score24h * 100),
    '7d':  Math.round(e.score7d * 100),
  }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Bar list */}
      <div className="flex flex-col gap-3">
        {top.map((e) => (
          <motion.div
            key={e.productId}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-medium text-slate-300">{e.name}</span>
                {e.anomalyFlags.length > 0 && (
                  <span className="ml-2 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                    ⚠ ANOMALY
                  </span>
                )}
              </div>
              <span className={`text-xs font-medium ${
                e.trend === 'rising' ? 'text-red-400' :
                e.trend === 'falling' ? 'text-emerald-400' : 'text-slate-500'
              }`}>
                {e.trend === 'rising' ? '↑ Rising' : e.trend === 'falling' ? '↓ Falling' : '→ Stable'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <VolBar label="1h" value={e.score1h} />
              <VolBar label="4h" value={e.score4h} />
              <VolBar label="24h" value={e.score24h} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Radar chart */}
      {radarData.length > 2 && (
        <div className="flex flex-col">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Volatility Radar (24h)
          </h4>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                <Radar
                  name="24h"
                  dataKey="24h"
                  stroke="#38bdf8"
                  fill="#38bdf8"
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a', border: '1px solid #334155',
                    borderRadius: '8px', fontSize: '11px', color: '#cbd5e1',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
