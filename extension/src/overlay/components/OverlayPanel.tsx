/**
 * OverlayPanel.tsx
 *
 * Larger detail panel injected on product / production pages where
 * there is enough real-estate to show full metric cards.
 */

import React, { useState } from 'react';
import type { OverlayMetrics, MarketDirection } from '../types';

const DIR_LABEL: Record<MarketDirection, string> = {
  strong_up:   '⇑ Strong Bullish',
  up:          '↑ Bullish',
  flat:        '→ Stable',
  down:        '↓ Bearish',
  strong_down: '⇓ Strong Bearish',
};

const DIR_COLOR: Record<MarketDirection, string> = {
  strong_up:   '#34d399',
  up:          '#4ade80',
  flat:        '#94a3b8',
  down:        '#f87171',
  strong_down: '#ef4444',
};

const PANEL_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:host { all: initial; }
.sca-panel {
  font-family: 'Inter','SF Pro Text',system-ui,sans-serif;
  background: rgba(8,12,20,0.95);
  border: 1px solid rgba(148,163,184,0.2);
  border-radius: 12px;
  padding: 14px 16px 12px;
  width: 260px;
  color: #cbd5e1;
  font-size: 12px;
  line-height: 1.5;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  pointer-events: auto;
  animation: sca-panel-in 0.3s cubic-bezier(0.16,1,0.3,1) both;
}
@keyframes sca-panel-in {
  from { opacity: 0; transform: translateY(12px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}
.sca-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(148,163,184,0.12);
}
.sca-panel-title {
  font-size: 13px;
  font-weight: 700;
  color: #e2e8f0;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sca-logo {
  font-size: 9px;
  color: #475569;
  font-weight: 500;
  letter-spacing: 0.04em;
  flex-shrink: 0;
  margin-left: 8px;
}
.sca-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}
.sca-metric-card {
  background: rgba(30,41,59,0.7);
  border: 1px solid rgba(148,163,184,0.1);
  border-radius: 8px;
  padding: 8px 10px;
}
.sca-metric-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #475569;
  margin-bottom: 3px;
}
.sca-metric-value {
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.sca-bar-track {
  height: 3px;
  background: rgba(51,65,85,0.8);
  border-radius: 99px;
  overflow: hidden;
  margin-top: 4px;
}
.sca-bar-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.5s cubic-bezier(0.16,1,0.3,1);
}
.sca-direction {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(30,41,59,0.5);
  border: 1px solid rgba(148,163,184,0.1);
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 8px;
}
.sca-footer {
  font-size: 9px;
  color: #334155;
  text-align: center;
  padding-top: 8px;
  border-top: 1px solid rgba(148,163,184,0.08);
}
.sca-collapse-btn {
  background: none;
  border: none;
  color: #475569;
  font-size: 14px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  transition: color 0.15s;
}
.sca-collapse-btn:hover { color: #94a3b8; }
`;

interface MetricCardProps {
  label: string;
  value: string;
  color: string;
  barPct?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, color, barPct }) => (
  <div className="sca-metric-card">
    <div className="sca-metric-label">{label}</div>
    <div className="sca-metric-value" style={{ color }}>{value}</div>
    {barPct !== undefined && (
      <div className="sca-bar-track">
        <div
          className="sca-bar-fill"
          style={{ width: `${barPct}%`, background: color }}
        />
      </div>
    )}
  </div>
);

interface Props {
  metrics: OverlayMetrics;
}

export const OverlayPanel: React.FC<Props> = ({ metrics }) => {
  const [collapsed, setCollapsed] = useState(false);
  const dirColor = DIR_COLOR[metrics.direction];
  const dirLabel = DIR_LABEL[metrics.direction];
  const profitColor = metrics.profitabilityScore >= 70 ? '#34d399'
    : metrics.profitabilityScore >= 45 ? '#fbbf24' : '#f87171';
  const confPct = Math.round(metrics.aiConfidence * 100);
  const confColor = confPct >= 80 ? '#34d399' : confPct >= 60 ? '#fbbf24' : '#94a3b8';
  const mom = metrics.momentum24h;
  const momStr = `${mom >= 0 ? '+' : ''}${(mom * 100).toFixed(1)}%`;
  const momColor = mom >= 0.03 ? '#4ade80' : mom <= -0.03 ? '#f87171' : '#94a3b8';

  return (
    <>
      <style>{PANEL_CSS}</style>
      <div className="sca-panel" role="complementary" aria-label="SCAnalytics market intelligence">
        <div className="sca-panel-header">
          <span className="sca-panel-title">{metrics.productName}</span>
          <button
            className="sca-collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand SCAnalytics panel' : 'Collapse SCAnalytics panel'}
          >
            {collapsed ? '▼' : '▲'}
          </button>
          <span className="sca-logo">SCAnalytics</span>
        </div>

        {!collapsed && (
          <>
            {/* Market direction */}
            <div className="sca-direction" style={{ color: dirColor, borderColor: `${dirColor}33` }}>
              <span style={{ fontSize: 16 }}>{metrics.direction.includes('up') ? '📈' : metrics.direction === 'flat' ? '→' : '📉'}</span>
              {dirLabel}
            </div>

            {/* 2×2 metric grid */}
            <div className="sca-grid">
              <MetricCard
                label="Profit Score"
                value={String(metrics.profitabilityScore)}
                color={profitColor}
                barPct={metrics.profitabilityScore}
              />
              <MetricCard
                label="AI Confidence"
                value={`${confPct}%`}
                color={confColor}
                barPct={confPct}
              />
              <MetricCard
                label="Volatility"
                value={`${Math.round(metrics.volatility * 100)}%`}
                color={metrics.volatility >= 0.6 ? '#ef4444' : metrics.volatility >= 0.3 ? '#fbbf24' : '#22d3ee'}
                barPct={Math.round(metrics.volatility * 100)}
              />
              <MetricCard
                label="Shortage Risk"
                value={`${Math.round(metrics.shortageRisk * 100)}%`}
                color={metrics.shortageRisk >= 0.7 ? '#f97316' : metrics.shortageRisk >= 0.4 ? '#fbbf24' : '#94a3b8'}
                barPct={Math.round(metrics.shortageRisk * 100)}
              />
            </div>

            {/* Secondary row */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '6px 0', borderTop: '1px solid rgba(148,163,184,0.08)',
              fontSize: 11,
            }}>
              <span style={{ color: '#64748b' }}>Momentum 24h</span>
              <span style={{ color: momColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {momStr}
              </span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '4px 0',
              fontSize: 11,
            }}>
              <span style={{ color: '#64748b' }}>VWAP Price</span>
              <span style={{ color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                ${metrics.currentPrice.toFixed(2)}
              </span>
            </div>
          </>
        )}

        <div className="sca-footer">Analytics only · No automated gameplay</div>
      </div>
    </>
  );
};
