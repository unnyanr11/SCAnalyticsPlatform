/**
 * OverlayBadge.tsx
 *
 * Compact inline badge injected next to each product row/card.
 * Renders inside a Shadow DOM so Sim Companies styles cannot affect it.
 *
 * Layout (horizontal, compact):
 *   [direction icon] [profit score] [confidence] [volatility dot] [shortage pill]
 */

import React, { useEffect, useRef, useState } from 'react';
import type { OverlayMetrics, MarketDirection } from '../types';

// ── Direction helpers ───────────────────────────────────────────────────
const DIR_CONFIG: Record<MarketDirection, { icon: string; color: string; label: string }> = {
  strong_up:   { icon: '⇑', color: '#34d399', label: 'Strong ↑' },
  up:          { icon: '↑',  color: '#4ade80', label: '↑ Bullish' },
  flat:        { icon: '→',  color: '#94a3b8', label: 'Flat'     },
  down:        { icon: '↓',  color: '#f87171', label: '↓ Bearish' },
  strong_down: { icon: '⇓', color: '#ef4444', label: 'Strong ↓' },
};

function profitColor(score: number): string {
  if (score >= 70) return '#34d399';
  if (score >= 45) return '#fbbf24';
  return '#f87171';
}

function shortageColor(risk: number): string {
  if (risk >= 0.7) return '#f97316';
  if (risk >= 0.4) return '#fbbf24';
  return '#94a3b8';
}

function volatilityDot(vol: number): string {
  if (vol >= 0.6) return '#ef4444';
  if (vol >= 0.3) return '#fbbf24';
  return '#22d3ee';
}

// ── Inline styles (no class names needed — Shadow DOM is isolated) ───────────

const RESET_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:host { all: initial; }
`;

const BADGE_CSS = `
.sca-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  border-radius: 20px;
  background: rgba(8, 12, 20, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.18);
  backdrop-filter: blur(8px);
  font-family: 'Inter', 'SF Pro Text', system-ui, sans-serif;
  font-size: 11px;
  line-height: 1;
  pointer-events: auto;
  user-select: none;
  white-space: nowrap;
  cursor: default;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  transition: opacity 0.2s ease, transform 0.2s ease;
  animation: sca-in 0.25s cubic-bezier(0.16,1,0.3,1) both;
}
.sca-badge:hover {
  border-color: rgba(148,163,184,0.4);
  transform: translateY(-1px);
}
@keyframes sca-in {
  from { opacity: 0; transform: translateY(4px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0)  scale(1); }
}
.sca-sep {
  width: 1px;
  height: 10px;
  background: rgba(148,163,184,0.2);
  display: inline-block;
  margin: 0 1px;
}
.sca-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(8,12,20,0.97);
  border: 1px solid rgba(148,163,184,0.25);
  border-radius: 8px;
  padding: 8px 10px;
  min-width: 180px;
  font-size: 11px;
  color: #cbd5e1;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
  pointer-events: none;
  z-index: 99999;
  animation: sca-in 0.15s ease both;
}
.sca-tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 2px 0;
}
.sca-tooltip-label { color: #64748b; }
.sca-tooltip-val   { font-weight: 600; font-variant-numeric: tabular-nums; }
.sca-host {
  position: relative;
  display: inline-block;
}
`;

// ── Component ───────────────────────────────────────────────────────────

interface Props {
  metrics: OverlayMetrics;
}

export const OverlayBadge: React.FC<Props> = ({ metrics }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [prevMetrics, setPrevMetrics] = useState(metrics);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (metrics.updatedAt !== prevMetrics.updatedAt) {
      setFlash(true);
      setPrevMetrics(metrics);
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [metrics.updatedAt]);

  const dir = DIR_CONFIG[metrics.direction];
  const pColor = profitColor(metrics.profitabilityScore);
  const sColor = shortageColor(metrics.shortageRisk);
  const vColor = volatilityDot(metrics.volatility);
  const confPct = Math.round(metrics.aiConfidence * 100);
  const mom = metrics.momentum24h;
  const momStr = `${mom >= 0 ? '+' : ''}${(mom * 100).toFixed(1)}%`;

  return (
    <>
      <style>{RESET_CSS + BADGE_CSS}</style>
      <div className="sca-host">
        <div
          className="sca-badge"
          style={{
            outline: flash ? `1px solid ${pColor}` : 'none',
            transition: flash ? 'outline 0s' : 'outline 0.6s ease',
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          role="status"
          aria-label={`SCAnalytics: ${metrics.productName} — ${dir.label}, profit ${metrics.profitabilityScore}`}
        >
          {/* Direction */}
          <span style={{ color: dir.color, fontWeight: 700, fontSize: 12 }}>
            {dir.icon}
          </span>

          {/* Profit score */}
          <span style={{ color: pColor, fontWeight: 600 }}>
            {metrics.profitabilityScore}
          </span>

          <span className="sca-sep" />

          {/* AI confidence */}
          <span style={{ color: '#94a3b8', fontSize: 10 }}>
            AI
          </span>
          <span style={{
            color: confPct >= 80 ? '#34d399' : confPct >= 60 ? '#fbbf24' : '#94a3b8',
            fontWeight: 600,
          }}>
            {confPct}%
          </span>

          <span className="sca-sep" />

          {/* Volatility dot */}
          <span
            title="Volatility"
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: vColor,
              display: 'inline-block',
              boxShadow: `0 0 4px ${vColor}88`,
              flexShrink: 0,
            }}
          />

          {/* Shortage risk (only show if meaningful) */}
          {metrics.shortageRisk >= 0.4 && (
            <>
              <span className="sca-sep" />
              <span style={{ color: sColor, fontSize: 10, fontWeight: 600 }}>
                ⚠ {Math.round(metrics.shortageRisk * 100)}%
              </span>
            </>
          )}
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div className="sca-tooltip" role="tooltip">
            <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 6, fontSize: 12 }}>
              {metrics.productName}
            </div>

            {([
              ['Direction',    dir.label,                    dir.color],
              ['Profit Score', String(metrics.profitabilityScore), pColor],
              ['AI Confidence',`${confPct}%`,                confPct >= 80 ? '#34d399' : confPct >= 60 ? '#fbbf24' : '#94a3b8'],
              ['Momentum 24h', momStr,                       mom >= 0 ? '#4ade80' : '#f87171'],
              ['Volatility',   `${Math.round(metrics.volatility * 100)}%`, vColor],
              ['Shortage Risk',`${Math.round(metrics.shortageRisk * 100)}%`, sColor],
              ['Price (VWAP)', `$${metrics.currentPrice.toFixed(2)}`, '#94a3b8'],
            ] as [string, string, string][]).map(([label, val, color]) => (
              <div key={label} className="sca-tooltip-row">
                <span className="sca-tooltip-label">{label}</span>
                <span className="sca-tooltip-val" style={{ color }}>{val}</span>
              </div>
            ))}

            <div style={{
              marginTop: 6,
              paddingTop: 6,
              borderTop: '1px solid rgba(148,163,184,0.15)',
              color: '#475569',
              fontSize: 9,
              textAlign: 'right',
            }}>
              SCAnalytics · analytics only
            </div>
          </div>
        )}
      </div>
    </>
  );
};
