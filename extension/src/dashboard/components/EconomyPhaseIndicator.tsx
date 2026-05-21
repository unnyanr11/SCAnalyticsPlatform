import React from 'react';
import { motion } from 'framer-motion';
import { useDashboardStore } from '../store';
import type { EconomyPhase } from '../types';

const PHASE_CONFIG: Record<EconomyPhase, {
  color: string; ring: string; bg: string; icon: string; accent: string;
}> = {
  boom:      { color: 'text-emerald-400', ring: 'ring-emerald-500/40', bg: 'bg-emerald-500/10', icon: '📈', accent: 'border-emerald-500/30' },
  stable:    { color: 'text-sky-400',     ring: 'ring-sky-500/40',     bg: 'bg-sky-500/10',     icon: '⚖️', accent: 'border-sky-500/30' },
  recession: { color: 'text-red-400',     ring: 'ring-red-500/40',     bg: 'bg-red-500/10',     icon: '📉', accent: 'border-red-500/30' },
  recovery:  { color: 'text-amber-400',   ring: 'ring-amber-500/40',   bg: 'bg-amber-500/10',   icon: '🔄', accent: 'border-amber-500/30' },
};

export const EconomyPhaseIndicator: React.FC = () => {
  const { phase } = useDashboardStore();

  if (!phase) {
    return (
      <div className="h-28 flex items-center justify-center text-slate-600 text-sm">
        Loading economy data…
      </div>
    );
  }

  const cfg = PHASE_CONFIG[phase.phase];

  return (
    <motion.div
      key={phase.phase}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-xl border ${cfg.accent} ${cfg.bg} p-5 ring-1 ${cfg.ring} relative overflow-hidden`}
    >
      {/* Ambient glow */}
      <div
        className={`absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-20 ${
          phase.phase === 'boom' ? 'bg-emerald-500' :
          phase.phase === 'recession' ? 'bg-red-500' :
          phase.phase === 'recovery' ? 'bg-amber-500' : 'bg-sky-500'
        }`}
      />

      <div className="relative flex items-start gap-4">
        <div className={`text-4xl select-none`}>{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold uppercase tracking-widest ${cfg.color}`}>
              Economy Phase
            </span>
          </div>
          <h3 className={`text-lg font-bold ${cfg.color} mb-1`}>{phase.label}</h3>
          <p className="text-sm text-slate-400 leading-relaxed">{phase.description}</p>
        </div>
      </div>

      {/* Phase timeline */}
      <div className="mt-4 flex gap-1.5">
        {(['recession', 'recovery', 'stable', 'boom'] as EconomyPhase[]).map((p) => (
          <div
            key={p}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              p === phase.phase
                ? cfg.color.replace('text-', 'bg-').replace('-400', '-500')
                : 'bg-slate-700'
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-slate-600">
        <span>Recession</span><span>Recovery</span><span>Stable</span><span>Boom</span>
      </div>
    </motion.div>
  );
};
