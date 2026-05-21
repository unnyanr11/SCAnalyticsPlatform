// SC Analytics Platform — Data Collector
// Orchestrates market polling and historical storage

import { getResources, getMarketData, getEconomyPhase } from './api-provider.js';
import { CacheManager } from './cache-manager.js';
import { HistoricalStore } from '../storage/historical-store.js';

export class DataCollector {
  async pollMarket() {
    const resources = await getResources();
    if (!resources.length) return;

    const phase = await getEconomyPhase();
    await CacheManager.set('economy_phase', phase, 300000);

    const priorityResources = resources.slice(0, 20);
    const results = await Promise.allSettled(
      priorityResources.map(r => this.collectResource(r.id || r.db_letter || r.kind))
    );

    const collected = results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    await HistoricalStore.save(collected);
    return collected;
  }

  async collectResource(resourceId) {
    if (!resourceId) return null;
    const cacheKey = 'market_' + resourceId;
    const cached = await CacheManager.get(cacheKey);
    if (cached) return { resourceId, data: cached, fromCache: true };

    const data = await getMarketData(resourceId);
    if (!data) return null;

    await CacheManager.set(cacheKey, data, 120000);
    return { resourceId, data, fromCache: false, ts: Date.now() };
  }
}
