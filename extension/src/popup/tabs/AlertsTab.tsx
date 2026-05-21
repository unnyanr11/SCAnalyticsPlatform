import React, { useEffect, useState } from 'react';
import { storageManager }  from '../../storage/StorageManager';
import type { AlertRecord } from '../../storage/StorageManager';
import { formatRelativeTime } from '../../utils/format';

const SEV_COLORS: Record<string, string> = {
  low:      '#0ea5e9',
  medium:   '#f59e0b',
  high:     '#ef4444',
  critical: '#dc2626',
};

export function AlertsTab(): JSX.Element {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);

  useEffect(() => {
    void storageManager.getAlertHistory().then(setAlerts);
  }, []);

  async function clearAll(): Promise<void> {
    await storageManager.clearAlertHistory();
    setAlerts([]);
  }

  return (
    <div className="tab-content">
      <div className="tab-toolbar">
        <span className="tab-toolbar-title">Alert History</span>
        {alerts.length > 0 && (
          <button className="btn-ghost" onClick={() => void clearAll()}>Clear all</button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🔔</span>
          <p>No alerts yet. Alerts appear when shortages, spikes, or opportunities are detected.</p>
        </div>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => (
            <div key={alert.id} className="alert-item">
              <div className="alert-header">
                <span
                  className="alert-severity"
                  style={{ color: SEV_COLORS[alert.severity] ?? '#94a3b8' }}
                >
                  [{alert.severity.toUpperCase()}]
                </span>
                <span className="alert-time">{formatRelativeTime(alert.timestamp)}</span>
              </div>
              <div className="alert-title">{alert.title}</div>
              <div className="alert-message">{alert.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
