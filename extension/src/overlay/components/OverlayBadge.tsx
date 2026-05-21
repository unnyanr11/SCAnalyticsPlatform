/**
 * Compact inline badge for market table rows and product list items.
 * Takes ~120px and stays completely non-intrusive.
 */
import React, { useEffect, useState } from 'react';
import type { OverlayMetrics } from '../overlayTypes';
import { signalLabel, signalColor, directionColor, directionLabel } from '../overlayUtils';

interface Props {
  initial: OverlayMetrics;
  subscribe: (fn: (m: OverlayMetrics) => void) => () => void;
  compact?: boolean;
}

export const OverlayBadge: React.FC<Props> = ({ initial, subscribe, compact }) => {
  const [m, setM] = useState<OverlayMetrics>(initial);
  useEffect(() => subscribe(setM), [subscribe]);

  if (compact) {
    // Single pill — signal only
    return (
      <span
        className="sca-row-badge"
        style={{
          color: signalColor(m.signal),
          borderColor: `${signalColor(m.signal)}35`,
          background: `${signalColor(m.signal)}10`,
        }}
        title={`AI Confidence: ${Math.round(m.aiConfidence * 100)}% · Profit: ${m.profitabilityScore}/100`}
      >
        {signalLabel(m.signal)}
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <span
        className="sca-row-badge"
        style={{
          color: signalColor(m.signal),
          borderColor: `${signalColor(m.signal)}35`,
          background: `${signalColor(m.signal)}10`,
        }}
        title={`Profit Score: ${m.profitabilityScore} · Margin: ${m.expectedMarginPct.toFixed(1)}%`}
      >
        {signalLabel(m.signal)}
      </span>
      <span
        className="sca-row-badge"
        style={{
          color: directionColor(m.marketDirection),
          borderColor: `${directionColor(m.marketDirection)}30`,
          background: `${directionColor(m.marketDirection)}0d`,
        }}
        title="Market direction"
      >
        {directionLabel(m.marketDirection)}
      </span>
    </span>
  );
};
