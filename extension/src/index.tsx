/**
 * SC Analytics Platform — Extension Entry Point
 *
 * Bootstraps the React application for the browser extension popup.
 * This file is strictly read-only analytics — NO gameplay automation.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('[SCAnalytics] Root element not found. Check popup HTML.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
