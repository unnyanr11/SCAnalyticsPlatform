import React, { useEffect, useState } from 'react';
import { storageManager }  from '../../storage/StorageManager';
import type { EconomyPhase } from '../../types/market';
import { formatRelativeTime } from '../../utils/format';

const PHASE_COLORS: Record<string, string> = {
  boom:      '#22c55e',
  stable:    '#0ea5e9',
  recession: '#ef4444',
  recovery:  '#f59e0b',
};

const PHASE_ICONS: Record<string, string> = {
  boom:      '🚀',
  stable:    '🟢',
  recession: '📉',
  recovery:  '💪',
};

export function DashboardTab(): JSX.Element {
  const [phase, setPhase]     = useState<EconomyPhase | null>(null);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    void storageManager.getPhase(0).then(setPhase);
    void storageManager.getAlertHistory().then((h) =>
      setAlertCount(h.filter((a) => !a.read).length),
    );
  }, []);

  return (
    <div className="tab-content">
      <section className="card">
        <div className="card-header">Economy Phase</div>
        {phase ? (
          <div className="phase-display">
            <span className="phase-icon">{PHASE_ICONS[phase.phase] ?? '❓'}</span>
            <span className="phase-label" style={{ color: PHASE_COLORS[phase.phase] ?? '#94a3b8' }}>
              {phase.phase.toUpperCase()}
            </span>
            <span className="phase-trend">Trend: {phase.trend}</span>
          </div>
        ) : (
          <div className="empty-state">Loading economy data…</div>
        )}
      </section>

      <section className="card">
        <div className="card-header">Quick Stats</div>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">{alertCount}</div>
            <div className="stat-label">Unread Alerts</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">—</div>
            <div className="stat-label">Signals Active</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">—</div>
            <div className="stat-label">Opportunities</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">Status</div>
        <div className="status-list">
          <div className="status-row">
            <span className="status-dot status-active" />
            <span>API Interceptor</span>
            <span className="status-badge status-ok">Active</span>
          </div>
          <div className="status-row">
            <span className="status-dot status-active" />
            <span>WebSocket Monitor</span>
            <span className="status-badge status-ok">Active</span>
          </div>
          <div className="status-row">
            <span className="status-dot status-idle" />
            <span>Backend AI</span>
            <span className="status-badge status-idle">Standby</span>
          </div>
        </div>
      </section>
    </div>
  );
}
