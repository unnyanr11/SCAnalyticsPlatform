/**
 * SC Analytics Platform — Market API Service
 *
 * Client-side service for fetching Sim Companies & SimcoTools
 * market data. All requests are read-only analytics queries.
 *
 * NO write operations. NO account mutations. NO automation.
 */

import type { MarketItem, ResourceInfo } from '../../shared/types/market';
import { SIMCO_API, SIMCOTOOLS_API } from '../../shared/constants/endpoints';

// ------------------------------------------------------------------
// Rate limiting — respect API limits
// ------------------------------------------------------------------

const REQUEST_DELAY_MS = 500;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ------------------------------------------------------------------
// Market Data
// ------------------------------------------------------------------

export async function fetchMarketItem(
  itemId: number,
  realm: number = 0
): Promise<MarketItem[]> {
  await sleep(REQUEST_DELAY_MS);
  const url = SIMCO_API.market(itemId, realm);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Market fetch failed: ${response.status}`);
  return response.json() as Promise<MarketItem[]>;
}

export async function fetchAllResources(): Promise<ResourceInfo[]> {
  await sleep(REQUEST_DELAY_MS);
  const response = await fetch(SIMCOTOOLS_API.resources);
  if (!response.ok) throw new Error(`Resources fetch failed: ${response.status}`);
  return response.json() as Promise<ResourceInfo[]>;
}

export async function fetchEconomyPhase(realm: number = 0): Promise<unknown> {
  await sleep(REQUEST_DELAY_MS);
  const response = await fetch(SIMCOTOOLS_API.economyPhase(realm));
  if (!response.ok) throw new Error(`Economy phase fetch failed: ${response.status}`);
  return response.json();
}

export async function fetchResourceRetailInfo(
  realm: number = 0
): Promise<unknown> {
  await sleep(REQUEST_DELAY_MS);
  const url = SIMCO_API.retailInfo(realm);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Retail info fetch failed: ${response.status}`);
  return response.json();
}
