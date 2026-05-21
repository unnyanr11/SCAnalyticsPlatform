/**
 * SC Analytics Platform — useAlerts Hook
 *
 * Provides reactive access to the alert history stored in chrome.storage.
 */

import { useEffect, useState } from 'react';
import { storageManager }  from '../storage/StorageManager';
import type { AlertRecord } from '../storage/StorageManager';

export function useAlerts(): {
  alerts: AlertRecord[];
  unreadCount: number;
  clearAll: () => Promise<void>;
} {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);

  useEffect(() => {
    void storageManager.getAlertHistory().then(setAlerts);

    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('sca:alerts' in changes) {
        setAlerts((changes['sca:alerts'].newValue as AlertRecord[]) ?? []);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return {
    alerts,
    unreadCount: alerts.filter((a) => !a.read).length,
    clearAll: async () => {
      await storageManager.clearAlertHistory();
    },
  };
}
