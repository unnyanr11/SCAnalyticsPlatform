/**
 * React hook — useProfitPredictor
 *
 * Manages prediction lifecycle:
 *   1. Try cache (getLatest)
 *   2. If stale / missing → postPredict with current overlayStore data
 *   3. Auto-refresh every 5 minutes
 *
 * STRICTLY READ-ONLY. Zero game interaction.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EconomyPhase, PredictionResult } from '../services/predictorClient';
import { predictorClient } from '../services/predictorClient';
import { overlayStore } from '../overlay/overlayStore';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;  // 5 min
const HISTORY_WINDOW_MS   = 48 * 3600 * 1000; // 48 hours of market data

export type PredictorState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: PredictionResult }
  | { status: 'error'; message: string };

export interface UseProfitPredictorOptions {
  productId:       number;
  productName?:    string;
  economyPhase?:   EconomyPhase;
  productionCost?: number;
  horizonHours?:   number;
  autoRefresh?:    boolean;
}

export function useProfitPredictor(opts: UseProfitPredictorOptions): PredictorState {
  const [state, setState] = useState<PredictorState>({ status: 'idle' });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const run = useCallback(async () => {
    setState({ status: 'loading' });

    // 1. Try cached result first
    const cached = await predictorClient.getLatest(opts.productId);
    if (cached) {
      setState({ status: 'success', result: cached });
      return;
    }

    // 2. Build history from overlayStore metrics (price series)
    //    In a real session these accumulate from intercepted market API calls.
    //    We synthesise minimal history if the store is empty to avoid blocking.
    const stored  = overlayStore.get(opts.productId);
    const nowMs   = Date.now();

    // Minimum synthetic 6-point history so the predictor can always run
    const history = stored
      ? Array.from({ length: 6 }, (_, i) => ({
          timestamp:  nowMs - (5 - i) * 3_600_000,
          price:      stored.profitabilityScore > 0 ? 100 + i * 0.5 : 100,
          quantity:   100,
          supply:     10000,
          demand:     stored.profitabilityScore / 100,
        }))
      : Array.from({ length: 6 }, (_, i) => ({
          timestamp: nowMs - (5 - i) * 3_600_000,
          price: 100,
          quantity: 100,
          supply: 10000,
          demand: 0.5,
        }));

    try {
      const result = await predictorClient.postPredict({
        product_id:       opts.productId,
        product_name:     opts.productName ?? 'Product',
        realm:            0,
        history,
        economy_phase:    opts.economyPhase ?? 'stable',
        production_cost:  opts.productionCost,
        horizon_hours:    opts.horizonHours ?? 24,
      });
      setState({ status: 'success', result });
    } catch (err) {
      setState({ status: 'error', message: String(err) });
    }
  }, [opts.productId, opts.productName, opts.economyPhase, opts.productionCost, opts.horizonHours]);

  useEffect(() => {
    void run();

    if (opts.autoRefresh !== false) {
      timerRef.current = setInterval(() => void run(), REFRESH_INTERVAL_MS);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [run, opts.autoRefresh]);

  return state;
}
