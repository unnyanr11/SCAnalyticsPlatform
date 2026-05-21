import React, { useEffect, useState } from 'react';
import { storageManager }     from '../../storage/StorageManager';
import type { UserPreferences } from '../../storage/StorageManager';

export function SettingsTab(): JSX.Element {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void storageManager.getPreferences().then(setPrefs);
  }, []);

  async function save(): Promise<void> {
    if (prefs) {
      await storageManager.savePreferences(prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  function update<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    if (prefs) setPrefs({ ...prefs, [key]: value });
  }

  if (!prefs) return <div className="tab-content"><div className="empty-state">Loading…</div></div>;

  return (
    <div className="tab-content">
      <section className="card">
        <div className="card-header">Analytics Settings</div>

        <div className="setting-row">
          <label className="setting-label" htmlFor="sca-realm">Default Realm</label>
          <select
            id="sca-realm"
            className="setting-select"
            value={prefs.defaultRealm}
            onChange={(e) => update('defaultRealm', Number(e.target.value) as 0 | 1)}
          >
            <option value={0}>Americas</option>
            <option value={1}>Europe</option>
          </select>
        </div>

        <div className="setting-row">
          <label className="setting-label" htmlFor="sca-polling">Polling Interval (s)</label>
          <input
            id="sca-polling"
            type="number"
            className="setting-input"
            min={10}
            max={120}
            value={prefs.pollingIntervalSec}
            onChange={(e) => update('pollingIntervalSec', Number(e.target.value))}
          />
        </div>

        <div className="setting-row">
          <label className="setting-label" htmlFor="sca-confidence">Min Confidence (%)</label>
          <input
            id="sca-confidence"
            type="number"
            className="setting-input"
            min={0}
            max={100}
            value={Math.round(prefs.confidenceThreshold * 100)}
            onChange={(e) => update('confidenceThreshold', Number(e.target.value) / 100)}
          />
        </div>

        <div className="setting-row setting-row--toggle">
          <label className="setting-label">Enable Overlays</label>
          <button
            className={`toggle ${prefs.enableOverlays ? 'toggle--on' : ''}`}
            onClick={() => update('enableOverlays', !prefs.enableOverlays)}
            aria-pressed={prefs.enableOverlays}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        <div className="setting-row setting-row--toggle">
          <label className="setting-label">Shortage Alerts</label>
          <button
            className={`toggle ${prefs.enableShortageAlerts ? 'toggle--on' : ''}`}
            onClick={() => update('enableShortageAlerts', !prefs.enableShortageAlerts)}
            aria-pressed={prefs.enableShortageAlerts}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header">Backend</div>
        <div className="setting-row">
          <label className="setting-label" htmlFor="sca-backend">Server URL</label>
          <input
            id="sca-backend"
            type="text"
            className="setting-input setting-input--wide"
            value={prefs.backendUrl}
            onChange={(e) => update('backendUrl', e.target.value)}
          />
        </div>
      </section>

      <button className="btn-primary" onClick={() => void save()}>
        {saved ? '✓ Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
