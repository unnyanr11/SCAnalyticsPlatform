import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardStore } from '../store';
import type { AIRecommendation } from '../types';

const ACTION_STYLE: Record<AIRecommendation['action'], string> = {
  buy:     'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  sell:    'text-red-300 bg-red-500/15 border-red-500/30',
  produce: 'text-sky-300 bg-sky-500/15 border-sky-500/30',
  hold:    'text-slate-400 bg-slate-500/10 border-slate-500/25',
  watch:   'text-amber-300 bg-amber-500/15 border-amber-500/30',
};

const ACTION_ICON: Record<AIRecommendation['action'], string> = {
  buy: '↑', sell: '↓', produce: '⚙', hold: '—', watch: '👁',
};

const TAG_COLORS: Record<string, string> = {
  shortage_incoming: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  high_demand:       'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  bullish:           'bg-green-500/15 text-green-400 border-green-500/25',
  phase_boost:       'bg-purple-500/15 text-purple-400 border-purple-500/25',
  low_supply:        'bg-red-500/15 text-red-400 border-red-500/25',
  produce_now:       'bg-sky-500/15 text-sky-400 border-sky-500/25',
  oversaturated:     'bg-slate-500/15 text-slate-400 border-slate-500/25',
  bearish:           'bg-red-400/15 text-red-400 border-red-400/25',
  reduce_exposure:   'bg-orange-500/15 text-orange-400 border-orange-500/25',
  bullish_breakout:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  trending:          'bg-sky-500/15 text-sky-400 border-sky-500/25',
  shortage_risk:     'bg-amber-500/15 text-amber-400 border-amber-500/25',
};

const ConfidenceRing: React.FC<{ value: number }> = ({ value }) => {
  const pct = Math.round(value * 100);
  const r = 14;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;

  return (
    <div className="relative flex items-center justify-center w-12 h-12 shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48" className="rotate-[-90deg]">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#1e293b" strokeWidth="3" />
        <motion.circle
          cx="24" cy="24" r={r}
          fill="none"
          stroke={pct >= 80 ? '#34d399' : pct >= 60 ? '#fbbf24' : '#94a3b8'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - fill }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute text-[10px] font-bold tabular-nums text-slate-300">{pct}%</span>
    </div>
  );
};

export const AIRecommendations: React.FC = () => {
  const { recommendations } = useDashboardStore();

  if (!recommendations.length) {
    return (
      <div className="py-10 text-center text-slate-600 text-sm">
        Generating AI recommendations…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {recommendations.map((rec, i) => (
          <motion.div
            key={rec.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ delay: i * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex gap-4 hover:border-slate-600/70 transition-colors"
          >
            {/* Confidence ring */}
            <ConfidenceRing value={rec.confidence} />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2 mb-1.5">
                <span className="font-semibold text-slate-200">{rec.productName}</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${
                    ACTION_STYLE[rec.action]
                  }`}
                >
                  {ACTION_ICON[rec.action]} {rec.action}
                </span>
                <span
                  className={`text-xs font-mono tabular-nums ${
                    rec.expectedMargin >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {rec.expectedMargin >= 0 ? '+' : ''}{rec.expectedMargin.toFixed(1)}% margin
                </span>
              </div>

              <p className="text-sm text-slate-400 leading-relaxed mb-2">
                {rec.reasoning}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {rec.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                      TAG_COLORS[tag] ?? 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                    }`}
                  >
                    {tag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
