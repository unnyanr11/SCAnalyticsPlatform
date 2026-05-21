// SC Analytics Platform — Alert System
// Dispatches browser notifications and stores alert history

export const AlertSystem = {
  async dispatch(alert) {
    const settings = await chrome.storage.local.get('settings');
    const notifSettings = (settings.settings && settings.settings.notifications) || {};
    if (!settings.settings || !settings.settings.alertsEnabled) return;

    const typeMap = { shortage: notifSettings.shortage, spike: notifSettings.spike, arbitrage: notifSettings.arbitrage, phase: notifSettings.phase };
    if (!typeMap[alert.type]) return;

    const stored = await chrome.storage.local.get('alert_history');
    const history = stored.alert_history || [];
    history.unshift({ ...alert, id: Date.now(), read: false });
    await chrome.storage.local.set({ alert_history: history.slice(0, 100) });

    chrome.notifications.create('sca_' + Date.now(), {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icons/icon48.png'),
      title: 'SC Analytics — ' + alert.title,
      message: alert.message,
      priority: alert.severity === 'high' ? 2 : 1
    });
  },

  async getHistory() {
    const stored = await chrome.storage.local.get('alert_history');
    return stored.alert_history || [];
  },

  async markRead(alertId) {
    const stored = await chrome.storage.local.get('alert_history');
    const history = (stored.alert_history || []).map(a => a.id === alertId ? { ...a, read: true } : a);
    await chrome.storage.local.set({ alert_history: history });
  }
};
