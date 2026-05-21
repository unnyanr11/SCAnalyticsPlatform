import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardStore } from '../../store/dashboardStore';
import type { AIRecommendation } from '../../types/dashboard';

const ACTION_STYLES: Record<AIRecommendation['action'], string> = {
  BUY:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  SELL:    'bg-red-500/15 text-red-400 border-red-500/30',
  PRODUCE: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  HOLD:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  WATCH:   'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

const RISK_DOTS: Record<AIRecommendation['riskLevel'], string> = {
  LOW:    'bg-emerald-400',
  MEDIUM: 'bg-yellow-400',
  HIGH:   'bg-red-400',
};

const cardVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i: number) => ({ opacity: 1, x: 0, transition: { delay: i * 0.07, duration: 0.3, ease: [0.16, 1, 0.3, 1] } }),
  exit: { opacity: 0, x: 16, transition: { duration: 0.15 } },
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-sc-border rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs tabular-nums text-sc-text-muted w-8 text-right">{value}%</span>
    </div>
  );
}

export default function AIRecommendations() {
  const recs = useDashboardStore((s) => s.recommendations);
  const [expanded, setExpanded] = useState<string | null>(recs[0]?.id ?? null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-sc-text">AI Recommendations</h2>
        <span className="text-xs text-sc-text-faint">{recs.length} active signals</span>
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {recs.map((rec, i) => (
            <motion.div
              key={rec.id}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              layout
            >
              <button
                className="w-full text-left bg-sc-surface border border-sc-border rounded-xl p-4 hover:border-sc-accent/40 transition-colors group"
                onClick={() => setExpanded(expanded === rec.id ? null : rec.id)}
              >
                <div className="flex items-start gap-3">
                  {/* Action badge */}
                  <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ACTION_STYLES[rec.action]}`}>
                    {rec.action}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sc-text">{rec.productName}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOTS[rec.riskLevel]}`} />
                        <span className="text-xs text-sc-text-faint">{rec.riskLevel} risk</span>
                      </div>
                    </div>

                    {/* Confidence */}
                    <div className="mt-1.5">
                      <ConfidenceBar value={rec.confidence} />
                    </div>

                    {/* Key metrics row */}
                    <div className="flex items-center gap-4 mt-2">
                      <span className={`text-xs tabular-nums font-mono ${ rec.predictedMargin >= 0 ? 'text-emerald-400' : 'text-red-400' }`}>
                        {rec.predictedMargin >= 0 ? '+' : ''}{rec.predictedMargin.toFixed(1)}% margin
                      </span>
                      <span className={`text-xs tabular-nums font-mono ${ rec.roi >= 0 ? 'text-blue-400' : 'text-red-400' }`}>
                        ROI {rec.roi >= 0 ? '+' : ''}{rec.roi.toFixed(1)}%
                      </span>
                      <span className="text-xs text-sc-text-faint ml-auto">
                        Valid {new Date(rec.validUntil).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <span className={`text-sc-text-faint transition-transform duration-200 ${ expanded === rec.id ? 'rotate-180' : '' }`}>
                    ↓
                  </span>
                </div>

                {/* Expanded reasoning */}
                <AnimatePresence>
                  {expanded === rec.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-sc-border">
                        <p className="text-sm text-sc-text-muted leading-relaxed">{rec.reasoning}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {rec.tags.map((tag) => (
                            <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-sc-surface-offset text-sc-text-faint border border-sc-border">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
