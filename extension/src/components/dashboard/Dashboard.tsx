import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDashboardStore } from '../../store/dashboardStore';
import { useRealtimeTick } from '../../hooks/useDashboardData';
import LiveMarketTable from './LiveMarketTable';
import TrendingProducts from './TrendingProducts';
import VolatilityTracker from './VolatilityTracker';
import AIRecommendations from './AIRecommendations';
import EconomyPhasePanel from './EconomyPhasePanel';
import WatchlistPanel from './WatchlistPanel';

const NAV_ITEMS = [
  { id: 'market',     label: 'Live Market',   icon: '📊' },
  { id: 'trending',   label: 'Trending',      icon: '🔥' },
  { id: 'volatility', label: 'Volatility',    icon: '⚡' },
  { id: 'ai',         label: 'AI Recs',       icon: '🤖' },
  { id: 'phase',      label: 'Economy Phase', icon: '🌐' },
  { id: 'watchlist',  label: 'Watchlist',     icon: '👁' },
] as const;

const SECTION_MAP: Record<string, React.FC> = {
  market:     LiveMarketTable,
  trending:   TrendingProducts,
  volatility: VolatilityTracker,
  ai:         AIRecommendations,
  phase:      EconomyPhasePanel,
  watchlist:  WatchlistPanel,
};

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export default function Dashboard() {
  const activeSection = useDashboardStore((s) => s.activeSection);
  const setActiveSection = useDashboardStore((s) => s.setActiveSection);
  const phase = useDashboardStore((s) => s.phase);
  const lastTick = useDashboardStore((s) => s.lastTick);

  useRealtimeTick();

  const ActiveComponent = SECTION_MAP[activeSection] ?? LiveMarketTable;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-sc-bg text-sc-text font-sans">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-52 shrink-0 bg-sc-surface border-r border-sc-border">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sc-border">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-sc-accent" aria-label="SC Analytics">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 14l3-4 3 3 4-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-sm font-semibold tracking-tight text-sc-text">SC Analytics</span>
        </div>

        {/* Phase pill */}
        <div className="mx-3 mt-3 mb-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sc-surface-offset text-xs">
          <span>{phase.emoji}</span>
          <span className="font-medium text-sc-text-muted">{phase.label}</span>
          <span className="ml-auto text-sc-text-faint">{phase.confidence}%</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={[
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                activeSection === item.id
                  ? 'bg-sc-accent/15 text-sc-accent font-medium'
                  : 'text-sc-text-muted hover:bg-sc-surface-offset hover:text-sc-text',
              ].join(' ')}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Tick indicator */}
        <div className="px-4 py-3 border-t border-sc-border">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sc-green animate-pulse" />
            <span className="text-xs text-sc-text-faint">Live</span>
            <span className="ml-auto text-xs text-sc-text-faint tabular-nums">
              {new Date(lastTick).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-sc-surface border-t border-sc-border flex">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={[
              'flex-1 flex flex-col items-center py-2 text-xs transition-colors',
              activeSection === item.id ? 'text-sc-accent' : 'text-sc-text-faint',
            ].join(' ')}
          >
            <span className="text-lg mb-0.5">{item.icon}</span>
            <span className="truncate">{item.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-sc-border bg-sc-surface shrink-0">
          <h1 className="text-sm font-semibold text-sc-text">
            {NAV_ITEMS.find((n) => n.id === activeSection)?.label ?? 'Dashboard'}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-sc-text-faint">Realm 0 · A1</span>
            <span className="w-px h-4 bg-sc-border" />
            <span className="w-1.5 h-1.5 rounded-full bg-sc-green animate-pulse" />
            <span className="text-xs text-sc-text-faint">Connected</span>
          </div>
        </header>

        {/* Animated section content */}
        <div className="flex-1 overflow-y-auto p-4 pb-16 md:pb-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <ActiveComponent />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
