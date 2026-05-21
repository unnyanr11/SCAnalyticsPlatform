import { useEffect, useRef } from 'react';
import { useDashboardStore } from '../store';
import {
  MOCK_MARKET_ROWS, MOCK_PHASE, MOCK_TRENDING, MOCK_VOLATILITY,
} from '../mockData';
import type { MarketRow } from '../types';

/** Polls the backend (or mock data) for live market updates. */
export function useLiveMarket(intervalMs = 8000) {
  const {
    setMarketRows, setPhase, setTrending,
    setVolatilityEntries, setConnected, setLastUpdated,
  } = useDashboardStore();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const jitter = (v: number, pct = 0.02) =>
    parseFloat((v * (1 + (Math.random() - 0.5) * 2 * pct)).toFixed(4));

  const tick = () => {
    // Simulate live price jitter
    const updated: MarketRow[] = MOCK_MARKET_ROWS.map((r) => ({
      ...r,
      vwap: jitter(r.vwap),
      lowestAsk: jitter(r.lowestAsk),
      highestAsk: jitter(r.highestAsk),
      totalSupply: Math.max(0, r.totalSupply + Math.round((Math.random() - 0.48) * 200)),
      demandScore: Math.min(1, Math.max(0, r.demandScore + (Math.random() - 0.5) * 0.04)),
      updatedAt: new Date().toISOString(),
    }));
    setMarketRows(updated);
    setPhase(MOCK_PHASE);
    setTrending(MOCK_TRENDING);
    setVolatilityEntries(MOCK_VOLATILITY);
    setConnected(true);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    tick();
    timerRef.current = setInterval(tick, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setConnected(false);
    };
  }, [intervalMs]);
}
