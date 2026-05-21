// SC Analytics Platform — WebSocket Monitor
// Listens passively to WS messages for realtime events. Read-only.

(function () {
  'use strict';
  const OrigWS = window.WebSocket;
  class MonitoredWS extends OrigWS {
    constructor(url, protocols) {
      super(url, protocols);
      if (/simcompanies|pusher|sockjs/.test(url)) {
        this.addEventListener('message', (e) => {
          try {
            const data = JSON.parse(e.data);
            window.dispatchEvent(new CustomEvent('SCA_WS_MESSAGE', { detail: { url, data, ts: Date.now() } }));
          } catch (_) {}
        });
      }
    }
  }
  window.WebSocket = MonitoredWS;
  window.addEventListener('SCA_WS_MESSAGE', (e) => {
    chrome.runtime.sendMessage({ type: 'WS_DATA', url: e.detail.url, data: e.detail.data, ts: e.detail.ts }).catch(() => {});
  });
  console.log('[SCA] WS monitor active');
})();
