import React from 'react';
import { motion } from 'framer-motion';

import { useLiveMarket } from './hooks/useLiveMarket';
import { useAIRecommendations } from './hooks/useAIRecommendations';
import { useDashboardStore } from './store';

import { ConnectionStatus } from './components/ConnectionStatus';
import { EconomyPhaseIndicator } from './components/EconomyPhaseIndicator';
import { LiveMarketTable } from './components/LiveMarketTable';
import { TrendingProducts } from './components/TrendingProducts';
import { VolatilityTracker } from './components/VolatilityTracker';
import { AIRecommendations } from './components/AIRecommendations';
import { SectionCard } from './components/SectionCard';

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
};

export const DashboardPage: React.FC = () => {
  // Wire live data
  useLiveMarket(8000);
  useAIRecommendations(30000);

  const { realm, setRealm } = useDashboardStore();

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-200">
      {/* ── Ambient background ───────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none select-none" aria-hidden>
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-sky-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] bg-emerald-500/4 rounded-full blur-[100px]" />
      </div>

      {/* ── Top bar ──────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#080c14]/90 backdrop-blur-md border-b border-slate-700/40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="SCAnalytics logo">
              <rect width="28" height="28" rx="7" fill="#0ea5e9" fillOpacity="0.15" />
              <path d="M6 20 L10 13 L14 17 L18 10 L22 14" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="22" cy="14" r="2.5" fill="#0ea5e9" />
            </svg>
            <span className="font-bold text-sm tracking-tight text-slate-200">
              SC<span className="text-sky-400">Analytics</span>
            </span>
            <span className="text-xs text-slate-600 font-mono hidden sm:block">v1.0</span>
          </div>

          {/* Realm switcher */}
          <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700/60 rounded-lg p-0.5">
            {([0, 1] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRealm(r)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  realm === r
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {r === 0 ? 'Alpha' : 'Beta'}
              </button>
            ))}
          </div>

          {/* Status */}
          <ConnectionStatus />
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────── */}
      <main className="relative max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-6"
        >
          {/* Row 1 — Economy phase (full width) */}
          <SectionCard
            title="Economy Phase"
            subtitle="Macro strategy context"
            icon="🌐"
            accent="emerald"
          >
            <EconomyPhaseIndicator />
          </SectionCard>

          {/* Row 2 — AI Recommendations + Trending side by side on large screens */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-3">
              <SectionCard
                title="AI Recommendations"
                subtitle="Confidence-scored strategies"
                icon="🤖"
                accent="purple"
              >
                <AIRecommendations />
              </SectionCard>
            </div>
            <div className="xl:col-span-2">
              <SectionCard
                title="Trending Products"
                subtitle="Biggest movers (24h)"
                icon="🔥"
                accent="amber"
              >
                <TrendingProducts />
              </SectionCard>
            </div>
          </div>

          {/* Row 3 — Volatility tracker */}
          <SectionCard
            title="Volatility Tracker"
            subtitle="Multi-window anomaly detection"
            icon="⚡"
            accent="red"
          >
            <VolatilityTracker />
          </SectionCard>

          {/* Row 4 — Live market table */}
          <SectionCard
            title="Live Market Intelligence"
            subtitle="Realtime prices · AI signals · Watchlist"
            icon="📊"
            accent="sky"
          >
            <LiveMarketTable />
          </SectionCard>
        </motion.div>
      </main>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-slate-700/30 mt-8 py-4 text-center text-xs text-slate-700">
        SCAnalytics · Analytics only · No automated gameplay · All data sourced from public APIs
      </footer>
    </div>
  );
};

export default DashboardPage;
