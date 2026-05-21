import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  title: string;
  subtitle?: string;
  icon?: string;
  children: React.ReactNode;
  accent?: 'default' | 'sky' | 'emerald' | 'amber' | 'red' | 'purple';
  headerRight?: React.ReactNode;
}

const ACCENT: Record<NonNullable<Props['accent']>, string> = {
  default: 'border-slate-700/60',
  sky:     'border-sky-500/30',
  emerald: 'border-emerald-500/30',
  amber:   'border-amber-500/30',
  red:     'border-red-500/30',
  purple:  'border-purple-500/30',
};

const TITLE_COLOR: Record<NonNullable<Props['accent']>, string> = {
  default: 'text-slate-300',
  sky:     'text-sky-400',
  emerald: 'text-emerald-400',
  amber:   'text-amber-400',
  red:     'text-red-400',
  purple:  'text-purple-400',
};

export const SectionCard: React.FC<Props> = ({
  title, subtitle, icon, children, accent = 'default', headerRight,
}) => (
  <motion.section
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-40px' }}
    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    className={`bg-slate-900/70 backdrop-blur-sm border ${ACCENT[accent]} rounded-2xl overflow-hidden`}
  >
    {/* Header */}
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-700/50">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-lg select-none">{icon}</span>}
        <div>
          <h2 className={`text-sm font-semibold ${TITLE_COLOR[accent]}`}>{title}</h2>
          {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
        </div>
      </div>
      {headerRight && <div className="shrink-0">{headerRight}</div>}
    </div>

    {/* Body */}
    <div className="p-5">
      {children}
    </div>
  </motion.section>
);
