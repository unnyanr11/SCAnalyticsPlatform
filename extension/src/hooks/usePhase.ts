/**
 * SC Analytics Platform — usePhase Hook
 *
 * Returns the current cached economy phase for a given realm,
 * with automatic re-fetch every 15 minutes.
 */

import { useEffect, useState } from 'react';
import { storageManager } from '../storage/StorageManager';
import type { EconomyPhase } from '../types/market';

export function usePhase(realm: 0 | 1 = 0): EconomyPhase | null {
  const [phase, setPhase] = useState<EconomyPhase | null>(null);

  useEffect(() => {
    void storageManager.getPhase(realm).then(setPhase);

    const interval = setInterval(() => {
      void storageManager.getPhase(realm).then(setPhase);
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [realm]);

  return phase;
}
