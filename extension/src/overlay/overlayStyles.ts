/**
 * CSS injected into each Shadow DOM root.
 * Kept as a tagged template string so it tree-shakes easily.
 * No external stylesheet dependency — fully self-contained.
 */
export const OVERLAY_CSS = /* css */`
  :host {
    all: initial;
    font-family: -apple-system, 'Inter', sans-serif;
    font-size: 12px;
    line-height: 1.4;
    color-scheme: dark;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* ─── Badge ─────────────────────────────────────────── */
  .sca-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border-radius: 9999px;
    border: 1px solid;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
    cursor: default;
    transition: opacity 180ms ease;
    vertical-align: middle;
  }

  /* ─── Panel ─────────────────────────────────────────── */
  .sca-panel {
    background: rgba(8, 12, 20, 0.92);
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: 10px;
    padding: 10px 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(14, 165, 233, 0.06);
    backdrop-filter: blur(12px);
    min-width: 180px;
    max-width: 260px;
    pointer-events: none; /* never intercept clicks */
  }

  .sca-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
  }

  .sca-brand {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: rgba(14, 165, 233, 0.7);
    text-transform: uppercase;
  }

  /* ─── Score ring ────────────────────────────────────── */
  .sca-score-ring {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .sca-score-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .sca-score-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: rgba(148, 163, 184, 0.6);
    line-height: 1.2;
  }

  /* ─── Metric rows ───────────────────────────────────── */
  .sca-metrics {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sca-metric {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .sca-metric-label {
    font-size: 10px;
    color: rgba(148, 163, 184, 0.55);
    white-space: nowrap;
  }

  .sca-metric-value {
    font-size: 10px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* ─── Bar ────────────────────────────────────────────── */
  .sca-bar-track {
    flex: 1;
    height: 3px;
    background: rgba(30, 41, 59, 1);
    border-radius: 9999px;
    overflow: hidden;
    min-width: 40px;
  }

  .sca-bar-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 0.5s cubic-bezier(0.16,1,0.3,1);
  }

  /* ─── Footer reasoning ──────────────────────────────── */
  .sca-reasoning {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid rgba(148, 163, 184, 0.08);
    font-size: 9.5px;
    color: rgba(148, 163, 184, 0.45);
    line-height: 1.5;
    font-style: italic;
  }

  /* ─── Inline row badge (for table rows) ──────────────────── */
  .sca-row-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 5px;
    border-radius: 4px;
    border: 1px solid;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.03em;
    white-space: nowrap;
    pointer-events: none;
    margin-left: 6px;
    vertical-align: middle;
  }

  /* ─── Entrance animation ────────────────────────────── */
  @keyframes sca-enter {
    from { opacity: 0; transform: translateY(4px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)   scale(1);    }
  }

  .sca-panel, .sca-badge, .sca-row-badge {
    animation: sca-enter 220ms cubic-bezier(0.16,1,0.3,1) both;
  }

  /* ─── Updated pulse ───────────────────────────────── */
  @keyframes sca-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }

  .sca-live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #34d399;
    animation: sca-pulse 2s ease-in-out infinite;
    display: inline-block;
    box-shadow: 0 0 4px #34d399;
  }
`;
