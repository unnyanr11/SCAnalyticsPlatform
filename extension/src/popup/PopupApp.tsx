/**
 * SC Analytics Platform — Popup App Root
 *
 * 360x560 popup with tab navigation:
 *   • Dashboard — live signals summary
 *   • Signals   — per-resource analytics
 *   • Alerts    — active alert history
 *   • Settings  — preferences
 */

import React, { useState } from 'react';
import { DashboardTab } from './tabs/DashboardTab';
import { SignalsTab }   from './tabs/SignalsTab';
import { AlertsTab }    from './tabs/AlertsTab';
import { SettingsTab }  from './tabs/SettingsTab';
import { cn }           from '../utils/cn';

type Tab = 'dashboard' | 'signals' | 'alerts' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'signals',   label: 'Signals',   icon: '📈' },
  { id: 'alerts',    label: 'Alerts',    icon: '🔔' },
  { id: 'settings',  label: 'Settings',  icon: '⚙️' },
];

export function PopupApp(): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <div className="popup-root">
      {/* Header */}
      <header className="popup-header">
        <div className="popup-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               aria-label="SC Analytics logo" className="logo-icon">
            <path d="M3 20L9 14L13 18L21 8" stroke="#22d3ee" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="21" cy="8" r="2" fill="#22d3ee"/>
            <circle cx="13" cy="18" r="2" fill="#0ea5e9"/>
          </svg>
          <span className="popup-title">SC Analytics</span>
        </div>
        <div className="popup-status">
          <span className="status-dot status-active" />
          <span className="status-label">Live</span>
        </div>
      </header>

      {/* Tab content */}
      <main className="popup-content">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'signals'   && <SignalsTab />}
        {activeTab === 'alerts'    && <AlertsTab />}
        {activeTab === 'settings'  && <SettingsTab />}
      </main>

      {/* Bottom nav */}
      <nav className="popup-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={cn('nav-tab', activeTab === tab.id && 'nav-tab--active')}
            onClick={() => setActiveTab(tab.id)}
            aria-label={tab.label}
          >
            <span className="nav-tab-icon">{tab.icon}</span>
            <span className="nav-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
