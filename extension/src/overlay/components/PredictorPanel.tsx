/**
 * PredictorPanel — full AI Profit Predictor overlay panel.
 *
 * Renders inside Shadow DOM via the predictorInjector.
 * Shows: recommendation, margins, ROI, risk score, forecast sparkline,
 * confidence bar, and all reasoning steps.
 *
 * pointer-events: none on host — zero gameplay interference.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import type { PredictionResult, ReasoningStep } from '../../services/predictorClient';
import type { UseProfitPredictorOptions } from '../../hooks/useProfitPredictor';
import { useProfitPredictor } from '../../hooks/useProfitPredictor';

// ── Colour helpers ────────────────────────────────────────────────────────────

const REC_COLORS: Record<string, string> = {
  strong_buy:  '#34d399',
  buy:         '#4ade80',
  hold:        '#94a3b8',
  sell:        '#fb923c',
  strong_sell: '#f87171',
};

const REC_LABELS: Record<string, string> = {
  strong_buy:  '↑↑ Strong Buy',
  buy:         '↑ Buy',
  hold:        '— Hold',
  sell:        '↓ Sell',
  strong_sell: '↓↓ Strong Sell',
};

const IMPACT_COLOR: Record<string, string> = {
  positive: '#34d399',
  negative: '#f87171',
  neutral:  '#94a3b8',
};

const IMPACT_ICON: Record<string, string> = {
  positive: '▲',
  negative: '▼',
  neutral:  '●',
};

function pct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function riskLabel(r: number): string {
  if (r >= 0.7) return 'High';
  if (r >= 0.4) return 'Medium';
  return 'Low';
}

function riskColor(r: number): string {
  if (r >= 0.7) return '#f87171';
  if (r >= 0.4) return '#fbbf24';
  return '#34d399';
}

// ── Sparkline (SVG) ───────────────────────────────────────────────────────────

const Sparkline: React.FC<{ points: number[]; width?: number; height?: number }> = ({
  points, width = 200, height = 36,
}) => {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const xs = points.map((_, i) => (i / (points.length - 1)) * width);
  const ys = points.map((v) => height - ((v - min) / range) * (height - 4) - 2);
  const d  = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const fill = `${d} L ${width} ${height} L 0 ${height} Z`;

  const trend = points[points.length - 1] >= points[0];
  const stroke = trend ? '#34d399' : '#f87171';

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={stroke} stopOpacity="0.3" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#sg)" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ── Bar component ─────────────────────────────────────────────────────────────

const Bar: React.FC<{ value: number; color: string; label: string; displayValue: string }> = ({
  value, color, label, displayValue,
}) => (
  <div style={{ marginBottom: 5 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
      <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
        {displayValue}
      </span>
    </div>
    <div style={{ height: 3, background: 'rgba(30,41,59,1)', borderRadius: 9999, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.round(value * 100)}%`,
        background: color, borderRadius: 9999,
        transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
      }} />
    </div>
  </div>
);

// ── Reasoning step ─────────────────────────────────────────────────────────────

const StepRow: React.FC<{ step: ReasoningStep }> = ({ step }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: 6,
    padding: '4px 0',
    borderBottom: '1px solid rgba(148,163,184,0.06)',
  }}>
    <span style={{ color: IMPACT_COLOR[step.impact], fontSize: 8, marginTop: 2, flexShrink: 0 }}>
      {IMPACT_ICON[step.impact]}
    </span>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.7)', marginBottom: 1 }}>
        {step.factor}
      </div>
      <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.45)', lineHeight: 1.5 }}>
        {step.description}
      </div>
    </div>
    <span style={{ fontSize: 8, color: 'rgba(148,163,184,0.3)', flexShrink: 0 }}>
      {(step.weight * 100).toFixed(0)}%
    </span>
  </div>
);

// ── Loading skeleton ──────────────────────────────────────────────────────────

const Skeleton: React.FC = () => (
  <div style={{
    background: 'rgba(8,12,20,0.92)', border: '1px solid rgba(148,163,184,0.12)',
    borderRadius: 10, padding: '10px 12px', minWidth: 220, maxWidth: 280,
  }}>
    <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(14,165,233,0.7)', letterSpacing: '0.08em', marginBottom: 8 }}>
      SC ANALYTICS · AI PREDICTOR
    </div>
    {[80, 60, 90, 50].map((w, i) => (
      <div key={i} style={{
        height: i === 0 ? 16 : 8, width: `${w}%`,
        background: 'rgba(30,41,59,0.8)', borderRadius: 4, marginBottom: 6,
        animation: 'sca-pulse 1.5s ease-in-out infinite',
      }} />
    ))}
  </div>
);

// ── Error state ───────────────────────────────────────────────────────────────

const ErrorPanel: React.FC<{ message: string }> = ({ message }) => (
  <div style={{
    background: 'rgba(8,12,20,0.92)', border: '1px solid rgba(248,113,113,0.2)',
    borderRadius: 10, padding: '8px 12px', fontSize: 9, color: '#f87171', maxWidth: 240,
  }}>
    <span style={{ fontWeight: 700 }}>AI Predictor offline</span>
    <br />
    <span style={{ color: 'rgba(148,163,184,0.4)', marginTop: 2 }}>Backend unreachable</span>
  </div>
);

// ── Main Panel ────────────────────────────────────────────────────────────────

const ResultPanel: React.FC<{ r: PredictionResult }> = ({ r }) => {
  const sparkPrices = useMemo(
    () => r.price_forecast.slice(0, 24).map((p) => p.price),
    [r.price_forecast],
  );

  const recColor = REC_COLORS[r.recommendation] ?? '#94a3b8';

  return (
    <div style={{
      background: 'rgba(8,12,20,0.92)',
      border: '1px solid rgba(148,163,184,0.12)',
      borderRadius: 10, padding: '10px 12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(12px)',
      minWidth: 220, maxWidth: 280,
      fontFamily: '-apple-system, Inter, sans-serif',
      color: 'rgba(148,163,184,0.9)',
      fontSize: 11,
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(14,165,233,0.7)', letterSpacing: '0.08em' }}>
          SC ANALYTICS · AI PREDICTOR
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '1px 6px', borderRadius: 9999,
          background: `${recColor}12`, border: `1px solid ${recColor}35`,
          fontSize: 9, fontWeight: 700, color: recColor,
        }}>
          {REC_LABELS[r.recommendation] ?? r.recommendation}
        </span>
      </div>

      {/* Key metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 10 }}>
        {[
          { label: 'Margin',     value: pct(r.predicted_margin_pct), color: r.predicted_margin_pct >= 0 ? '#34d399' : '#f87171' },
          { label: 'ROI (24h)', value: pct(r.expected_roi_pct),    color: r.expected_roi_pct >= 0 ? '#34d399' : '#f87171' },
          { label: 'Risk',       value: riskLabel(r.risk_score),   color: riskColor(r.risk_score) },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'rgba(30,41,59,0.5)', borderRadius: 6, padding: '4px 6px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.45)', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Sparkline */}
      {sparkPrices.length >= 2 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.4)', marginBottom: 3 }}>24h Price Forecast</div>
          <Sparkline points={sparkPrices} width={220} height={36} />
        </div>
      )}

      {/* Bars */}
      <Bar value={r.confidence}      color="#38bdf8" label="AI Confidence"    displayValue={`${Math.round(r.confidence * 100)}%`} />
      <Bar value={r.volatility_score} color={r.volatility_score >= 0.6 ? '#f87171' : '#fbbf24'} label="Volatility" displayValue={`${Math.round(r.volatility_score * 100)}`} />
      <Bar value={r.shortage_risk}    color={riskColor(r.shortage_risk)} label="Shortage Risk" displayValue={`${Math.round(r.shortage_risk * 100)}%`} />

      {/* Reasoning summary */}
      <div style={{
        marginTop: 8, padding: '6px 8px',
        background: 'rgba(14,165,233,0.05)',
        border: '1px solid rgba(14,165,233,0.1)',
        borderRadius: 6, fontSize: 9.5,
        color: 'rgba(148,163,184,0.55)', lineHeight: 1.5, fontStyle: 'italic',
      }}>
        {r.reasoning_summary}
      </div>

      {/* Reasoning steps (collapsible) */}
      <details style={{ marginTop: 8 }}>
        <summary style={{
          fontSize: 9, color: 'rgba(14,165,233,0.6)', cursor: 'pointer',
          letterSpacing: '0.04em', fontWeight: 700, userSelect: 'none',
        }}>
          AI REASONING ({r.reasoning_steps.length} factors)
        </summary>
        <div style={{ marginTop: 4 }}>
          {r.reasoning_steps.map((step, i) => (
            <StepRow key={i} step={step} />
          ))}
        </div>
      </details>

      {/* Footer */}
      <div style={{
        marginTop: 8, fontSize: 8, color: 'rgba(148,163,184,0.25)',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Prophet + XGBoost · Ensemble</span>
        <span>{new Date(r.generated_at).toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

// ── Export ────────────────────────────────────────────────────────────────────

export const PredictorPanel: React.FC<UseProfitPredictorOptions> = (opts) => {
  const state = useProfitPredictor(opts);

  if (state.status === 'idle' || state.status === 'loading') return <Skeleton />;
  if (state.status === 'error') return <ErrorPanel message={state.message} />;
  return <ResultPanel r={state.result} />;
};
