import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { useDashboardStore } from '../../store/dashboardStore';

function HeatCell({ value, label }: { value: number; label: string }) {
  const intensity = Math.round((value / 100) * 255);
  const r = intensity;
  const g = Math.round((1 - value / 100) * 180);
  const bg = `rgba(${r}, ${g}, 40, 0.25)`;
  const border = `rgba(${r}, ${g}, 40, 0.5)`;
  return (
    <div
      style={{ background: bg, borderColor: border }}
      className="border rounded-lg p-3 flex flex-col items-center gap-1"
    >
      <span className="text-xs text-sc-text-muted truncate w-full text-center">{label}</span>
      <span className="text-lg font-bold tabular-nums" style={{ color: `rgb(${r}, ${g}, 40)` }}>
        {value.toFixed(0)}
      </span>
    </div>
  );
}

export default function VolatilityTracker() {
  const volatility = useDashboardStore((s) => s.volatility);
  const [selected, setSelected] = useState(volatility[0]?.productId ?? 0);
  const entry = volatility.find((v) => v.productId === selected) ?? volatility[0];

  const radarData = entry ? [
    { subject: 'Volatility 1h', A: entry.volatility1h },
    { subject: 'Volatility 24h', A: entry.volatility24h },
    { subject: 'Volatility 7d', A: entry.volatility7d },
    { subject: 'RSI', A: entry.rsi },
    { subject: 'Anomaly', A: entry.anomalyScore * 100 },
    { subject: 'Std Dev', A: Math.min(entry.stdDev, 100) },
  ] : [];

  const barData = volatility.map((v) => ({
    name: v.name.slice(0, 8),
    '24h': +v.volatility24h.toFixed(1),
    '7d':  +v.volatility7d.toFixed(1),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-sc-text">Volatility Tracker</h2>
        <select
          value={selected}
          onChange={(e) => setSelected(+e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-sc-surface border border-sc-border text-sm text-sc-text focus:outline-none focus:border-sc-accent"
        >
          {volatility.map((v) => (
            <option key={v.productId} value={v.productId}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* Heatmap grid */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {volatility.map((v) => (
          <motion.button
            key={v.productId}
            onClick={() => setSelected(v.productId)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className={`${ selected === v.productId ? 'ring-1 ring-sc-accent' : '' } rounded-lg`}
          >
            <HeatCell value={v.volatility24h} label={v.name.slice(0, 6)} />
          </motion.button>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Radar */}
        <div className="bg-sc-surface border border-sc-border rounded-xl p-4">
          <h3 className="text-xs font-medium text-sc-text-muted mb-3">{entry?.name} — Radar</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="70%">
                <PolarGrid stroke="#2d3250" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Radar dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                <Tooltip
                  contentStyle={{ background: '#1e2230', border: '1px solid #2d3250', borderRadius: 6, fontSize: 11 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar chart */}
        <div className="bg-sc-surface border border-sc-border rounded-xl p-4">
          <h3 className="text-xs font-medium text-sc-text-muted mb-3">All products — Volatility comparison</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3250" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1e2230', border: '1px solid #2d3250', borderRadius: 6, fontSize: 11 }}
                />
                <Bar dataKey="24h" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="7d"  fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Flags */}
      {entry && entry.flags.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2"
        >
          {entry.flags.map((f) => (
            <span key={f} className="px-2.5 py-1 rounded-full text-xs bg-red-500/15 text-red-400 border border-red-500/25">
              ⚠ {f.replace(/_/g, ' ')}
            </span>
          ))}
        </motion.div>
      )}
    </div>
  );
}
