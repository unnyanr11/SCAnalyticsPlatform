/**
 * SC Analytics Platform — Root App Component
 *
 * Analytics-only interface. No automation, no gameplay control.
 */

import React from 'react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-sc-dark text-sc-text font-sans">
      <header className="flex items-center justify-between px-4 py-3 border-b border-sc-border">
        <div className="flex items-center gap-2">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-label="SC Analytics"
            className="text-sc-accent"
          >
            <polyline
              points="2,18 8,10 13,14 20,6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="20" y1="6" x2="20" y2="12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="20" y1="6" x2="14" y2="6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-sm font-semibold tracking-wide">
            SC Analytics
          </span>
        </div>
        <span className="text-xs text-sc-muted">v0.1.0</span>
      </header>

      <main className="p-4">
        <div className="rounded-lg border border-sc-border bg-sc-surface p-4 text-center">
          <p className="text-sc-muted text-sm">
            Connecting to Sim Companies market data…
          </p>
          <p className="text-xs text-sc-faint mt-2">
            Analytics &amp; decision support only — no automation.
          </p>
        </div>
      </main>
    </div>
  );
};

export default App;
