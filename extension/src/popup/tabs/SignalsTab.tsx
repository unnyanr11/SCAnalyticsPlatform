import React from 'react';

export function SignalsTab(): JSX.Element {
  return (
    <div className="tab-content">
      <section className="card">
        <div className="card-header">Market Signals</div>
        <div className="empty-state">
          <span className="empty-icon">📊</span>
          <p>Navigate to a market page in Sim Companies to load live signals.</p>
        </div>
      </section>
    </div>
  );
}
