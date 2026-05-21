import React from 'react';
import { motion } from 'framer-motion';
import { useDashboardStore } from '../../store/dashboardStore';
import { ALL_PHASES } from '../../utils/mockData';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

const PHASE_COLORS: Record<string, string> = {
  boom:      'text-emerald-400',
  stable:    'text-blue-400',
  recession: 'text-red-400',
  recovery:  'text-yellow-400',
};
const PHASE_BG: Record<string, string> = {
  boom:      'bg-emerald-500/10 border-emerald-500/25',
  stable:    'bg-blue-500/10 border-blue-500/25',
  recession: 'bg-red-500/10 border-red-500/25',
  recovery:  'bg-yellow-500/10 border-yellow-500/25',
};

// Mock economy index over time
const ECO_DATA = Array.from({ length: 48 }, (_, i) => ({
  h: i,
  index: 45 + Math.sin(i / 6) * 25 + Math.random() * 10,
}));

export default function EconomyPhasePanel() {
  const phase = useDashboardStore((s) => s.phase);
  const setPhase = useDashboardStore((s) => s.setPhase);

  const duration = Math.round(
    (Date.now() - new Date(phase.sinceTimestamp).getTime()) / 3_600_000
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-sc-text">Economy Phase</h2>
        <span className="text-xs text-sc-text-faint">Realm 0 · Confidence {phase.confidence}%</span>
      </div>

      {/* Current phase card */}
      <motion.div
        key={phase.code}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={`rounded-xl border p-5 ${PHASE_BG[phase.code] ?? 'bg-sc-surface border-sc-border'}`}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">{phase.emoji}</span>
          <div>
            <div className={`text-xl font-bold ${PHASE_COLORS[phase.code] ?? 'text-sc-text'}`}>
              {phase.label}
            </div>
            <div className="text-xs text-sc-text-faint mt-0.5">
              Active for {duration}h · Confidence {phase.confidence}%
            </div>
          </div>
          {/* Confidence bar */}
          <div className="ml-auto w-20">
            <div className="h-1.5 bg-sc-border rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${ phase.code === 'boom' ? 'bg-emerald-500' : phase.code === 'recession' ? 'bg-red-500' : phase.code === 'recovery' ? 'bg-yellow-500' : 'bg-blue-500' }`}
                initial={{ width: 0 }}
                animate={{ width: `${phase.confidence}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </div>
        </div>
        <p className="text-sm text-sc-text-muted mb-4">{phase.description}</p>
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-sc-text-muted uppercase tracking-wide mb-2">Strategy Recommendations</div>
          {phase.strategies.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-start gap-2"
            >
              <span className={`mt-0.5 ${PHASE_COLORS[phase.code] ?? 'text-sc-text'}`}>•</span>
              <span className="text-sm text-sc-text">{s}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Economy index chart */}
      <div className="bg-sc-surface border border-sc-border rounded-xl p-4">
        <h3 className="text-xs font-medium text-sc-text-muted mb-3">Economy Index — 48h</h3>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ECO_DATA} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3250" />
              <XAxis dataKey="h" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={(v) => `${v}h`} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} domain={[0, 100]} />
              <ReferenceLine y={50} stroke="#64748b" strokeDasharray="4 2" />
              <Tooltip
                contentStyle={{ background: '#1e2230', border: '1px solid #2d3250', borderRadius: 6, fontSize: 11 }}
                formatter={(v: number) => [v.toFixed(1), 'Index']}
                labelFormatter={(v) => `${v}h ago`}
              />
              <Line
                type="monotone" dataKey="index"
                stroke="#6366f1" strokeWidth={1.5}
                dot={false} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Phase switcher (demo) */}
      <div className="bg-sc-surface border border-sc-border rounded-xl p-4">
        <div className="text-xs font-semibold text-sc-text-muted uppercase tracking-wide mb-3">All Phases</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ALL_PHASES.map((p) => (
            <button
              key={p.code}
              onClick={() => setPhase({ ...p, sinceTimestamp: new Date().toISOString(), confidence: Math.round(Math.random() * 30 + 65) })}
              className={[
                'flex flex-col items-center gap-1 p-3 rounded-lg border transition-all',
                phase.code === p.code
                  ? `${PHASE_BG[p.code]} ${PHASE_COLORS[p.code]} font-semibold`
                  : 'border-sc-border hover:bg-sc-surface-offset text-sc-text-muted hover:text-sc-text',
              ].join(' ')}
            >
              <span className="text-xl">{p.emoji}</span>
              <span className="text-xs">{p.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
