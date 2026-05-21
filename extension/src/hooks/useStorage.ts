/**
 * SC Analytics Platform — useStorage Hook
 *
 * React hook that subscribes to a chrome.storage.local key and
 * provides a reactive getter + setter.
 *
 * Usage:
 *   const [watchlist, setWatchlist] = useStorage<number[]>('sca:watchlist', []);
 */

import { useCallback, useEffect, useState } from 'react';

export function useStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => Promise<void>] {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    void chrome.storage.local.get(key).then((result) => {
      if (key in result) setValue(result[key] as T);
    });

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
    ) => {
      if (key in changes) {
        setValue(changes[key].newValue as T);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [key]);

  const set = useCallback(
    async (newValue: T) => {
      await chrome.storage.local.set({ [key]: newValue });
    },
    [key],
  );

  return [value, set];
}
