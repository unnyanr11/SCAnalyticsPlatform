/**
 * Full analytics panel shown on product and production pages.
 * Rendered into a Shadow DOM mount point.
 */
import React, { useEffect, useState } from 'react';
import type { OverlayMetrics } from '../overlayTypes';
import {
  scoreColor, riskColor,
  directionLabel, directionColor,
  signalLabel, signalColor,
} from '../overlayUtils';

interface Props {
  initial: OverlayMetrics;
  subscribe: (fn: (m: OverlayMetrics) => void) => () => void;
}

const Bar: React.FC<{ value: number; color: string }> = ({ value, color }) => (
  <div className="sca-bar-track">
    <div
      className="sca-bar-fill"
      style={{ width: `${Math.round(value * 100)}%`, background: color }}
    />
  </div>
);

export const OverlayPanel: React.FC<Props> = ({ initial, subscribe }) => {
  const [m, setM] = useState<OverlayMetrics>(initial);

  useEffect(() => subscribe(setM), [subscribe]);

  const sc = scoreColor(m.profitabilityScore);

  return (
    <div className="sca-panel">
      {/* Header */}
      <div className="sca-panel-header">
        <span className="sca-brand">SC Analytics</span>
        <span className="sca-live-dot" title="Live" />
      </div>

      {/* Score + Signal */}
      <div className="sca-score-ring">
        <span className="sca-score-value" style={{ color: sc }}>
          {m.profitabilityScore}
        </span>
        <div>
          <div className="sca-score-label">Profit Score</div>
          <span
            className="sca-badge"
            style={{
              color: signalColor(m.signal),
              borderColor: `${signalColor(m.signal)}40`,
              background: `${signalColor(m.signal)}12`,
            }}
          >
            {signalLabel(m.signal)}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="sca-metrics">
        {/* AI Confidence */}
        <div className="sca-metric">
          <span className="sca-metric-label">AI Confidence</span>
          <Bar value={m.aiConfidence} color="#38bdf8" />
          <span className="sca-metric-value" style={{ color: '#38bdf8' }}>
            {Math.round(m.aiConfidence * 100)}%
          </span>
        </div>

        {/* Volatility */}
        <div className="sca-metric">
          <span className="sca-metric-label">Volatility</span>
          <Bar
            value={m.volatility}
            color={m.volatility >= 0.6 ? '#f87171' : m.volatility >= 0.3 ? '#fbbf24' : '#64748b'}
          />
          <span
            className="sca-metric-value"
            style={{ color: m.volatility >= 0.6 ? '#f87171' : '#94a3b8' }}
          >
            {Math.round(m.volatility * 100)}
          </span>
        </div>

        {/* Shortage Risk */}
        <div className="sca-metric">
          <span className="sca-metric-label">Shortage Risk</span>
          <Bar value={m.shortageRisk} color={riskColor(m.shortageRisk)} />
          <span className="sca-metric-value" style={{ color: riskColor(m.shortageRisk) }}>
            {Math.round(m.shortageRisk * 100)}%
          </span>
        </div>

        {/* Oversat Risk */}
        <div className="sca-metric">
          <span className="sca-metric-label">Oversat Risk</span>
          <Bar value={m.oversatRisk} color={riskColor(m.oversatRisk)} />
          <span className="sca-metric-value" style={{ color: riskColor(m.oversatRisk) }}>
            {Math.round(m.oversatRisk * 100)}%
          </span>
        </div>

        {/* Market Direction */}
        <div className="sca-metric">
          <span className="sca-metric-label">Direction</span>
          <span
            className="sca-metric-value"
            style={{ color: directionColor(m.marketDirection) }}
          >
            {directionLabel(m.marketDirection)}
          </span>
        </div>

        {/* Expected Margin */}
        <div className="sca-metric">
          <span className="sca-metric-label">Est. Margin</span>
          <span
            className="sca-metric-value"
            style={{ color: m.expectedMarginPct >= 0 ? '#34d399' : '#f87171' }}
          >
            {m.expectedMarginPct >= 0 ? '+' : ''}{m.expectedMarginPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Reasoning */}
      {m.reasoning && (
        <div className="sca-reasoning">{m.reasoning}</div>
      )}
    </div>
  );
};
