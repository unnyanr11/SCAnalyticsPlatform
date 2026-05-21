import React from 'react';
import { createRoot } from 'react-dom/client';
import { PopupApp } from './PopupApp';
import '../styles/popup.css';

const container = document.getElementById('sca-popup-root');
if (container) {
  const root = createRoot(container);
  root.render(<PopupApp />);
}
