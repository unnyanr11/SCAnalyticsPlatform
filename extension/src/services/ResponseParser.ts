/**
 * SC Analytics Platform — Response Parser
 *
 * Normalizes raw API responses from every supported Sim Companies
 * and SimcoTools endpoint into typed, canonical domain objects.
 *
 * Parsing is forgiving: unknown fields are discarded, missing optional
 * fields get safe defaults. A parse failure returns null and logs a warning
 * rather than throwing — the system remains live even if an endpoint changes.
 *
 * ⚠️ Read-only analytics only. No write operations.
 */

import type {
  MarketOffer,
  MarketSnapshot,
  ResourceInfo,
  EconomyPhase,
  Realm,
} from '../types/market';
import { log } from '../utils/logger';

// ---------------------------------------------------------------------------
// Endpoint identity
// ---------------------------------------------------------------------------

export type EndpointKind =
  | 'market_offers'       // GET /api/v2/market/{itemId}
  | 'encyclopedia'        // GET /api/v4/pt/{realm}/encyclopedia/resources/
  | 'retail_info'         // GET /api/v4/{realm}/resources-retail-info/
  | 'simcotools_resources'// simcotools.app/api/v3/resources
  | 'simcotools_phase'    // api.simcotools.com/v1/realms/{realm}/phases
  | 'unknown';

export interface ParsedResponse {
  kind:        EndpointKind;
  url:         string;
  realm:       Realm;
  timestamp:   number;
  raw:         unknown;   // kept for debugging / re-parsing if schema evolves

  // Populated based on kind
  offers?:     MarketOffer[];
  snapshot?:   MarketSnapshot;
  resources?:  ResourceInfo[];
  phase?:      EconomyPhase;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class ResponseParser {
  /**
   * Main entry point. Detect endpoint kind from URL, parse accordingly.
   * Returns null on unrecognised URLs or parse failures.
   */
  parse(url: string, data: unknown, timestamp: number): ParsedResponse | null {
    try {
      const kind  = detectEndpointKind(url);
      const realm = detectRealm(url);

      if (kind === 'unknown') return null;

      const base: ParsedResponse = { kind, url, realm, timestamp, raw: data };

      switch (kind) {
        case 'market_offers': {
          const offers = parseMarketOffers(data);
          if (!offers) return null;
          const itemId = extractItemId(url);
          return {
            ...base,
            offers,
            snapshot: buildSnapshot(itemId, realm, timestamp, offers),
          };
        }

        case 'encyclopedia':
          return { ...base, resources: parseEncyclopedia(data) ?? [] };

        case 'retail_info':
          return { ...base, resources: parseRetailInfo(data) ?? [] };

        case 'simcotools_resources':
          return { ...base, resources: parseSimcoToolsResources(data) ?? [] };

        case 'simcotools_phase': {
          const phase = parseSimcoToolsPhase(data, realm);
          return phase ? { ...base, phase } : null;
        }

        default:
          return null;
      }
    } catch (err) {
      log.warn('[ResponseParser] Parse error for', url, err);
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Endpoint detection
// ---------------------------------------------------------------------------

function detectEndpointKind(url: string): EndpointKind {
  if (/simcompanies\.com\/api\/v2\/market\/\d+/.test(url))           return 'market_offers';
  if (/simcompanies\.com\/api\/v4\/pt\/\d+\/encyclopedia/.test(url)) return 'encyclopedia';
  if (/simcompanies\.com\/api\/v4\/\d+\/resources-retail-info/.test(url)) return 'retail_info';
  if (/simcotools\.app\/api\/v3\/resources/.test(url))               return 'simcotools_resources';
  if (/api\.simcotools\.com\/v1\/realms\/\d+\/phases/.test(url))     return 'simcotools_phase';
  return 'unknown';
}

function detectRealm(url: string): Realm {
  // Realm appears as realm=0|1 query param, or as /pt/0/ or /v4/0/ path segment
  const qp = /[?&]realm=(\d)/.exec(url);
  if (qp) return (Number(qp[1]) === 1 ? 1 : 0) as Realm;
  const path = /\/(?:pt|v4|realms)\/(\d)\//.exec(url);
  if (path) return (Number(path[1]) === 1 ? 1 : 0) as Realm;
  return 0;
}

function extractItemId(url: string): number {
  const m = /\/market\/(\d+)/.exec(url);
  return m ? Number(m[1]) : 0;
}

// ---------------------------------------------------------------------------
// Market Offers  /api/v2/market/{itemId}
// ---------------------------------------------------------------------------

type RawOffer = Record<string, unknown>;

function parseMarketOffers(data: unknown): MarketOffer[] | null {
  if (!Array.isArray(data)) return null;

  const offers: MarketOffer[] = [];
  for (const item of data as RawOffer[]) {
    if (!item || typeof item !== 'object') continue;
    const offer = parseOffer(item);
    if (offer) offers.push(offer);
  }
  return offers;
}

function parseOffer(raw: RawOffer): MarketOffer | null {
  const id       = asNumber(raw['id']);
  const kind     = asNumber(raw['kind'] ?? raw['resource']);
  const quality  = asNumber(raw['quality'] ?? 0);
  const price    = asNumber(raw['price']);
  const quantity = asNumber(raw['quantity']);
  const seller   = asString(raw['seller'] ?? raw['company'] ?? '');
  const postedAt = asString(raw['posted'] ?? raw['created'] ?? new Date().toISOString());

  if (!price || !quantity) return null; // Skip invalid rows

  return { id, kind, quality, price, quantity, seller, postedAt };
}

function buildSnapshot(
  resourceId: number,
  realm: Realm,
  timestamp: number,
  offers: MarketOffer[],
): MarketSnapshot | null {
  if (!offers.length) return null;

  const prices = offers.map((o) => o.price);
  const total  = offers.reduce((s, o) => s + o.quantity, 0);
  const avg    = prices.reduce((s, p) => s + p, 0) / prices.length;

  return {
    resourceId,
    resourceName: String(resourceId), // enriched later by encyclopedia
    realm,
    timestamp,
    minPrice:   Math.min(...prices),
    maxPrice:   Math.max(...prices),
    avgPrice:   Math.round(avg * 100) / 100,
    totalVolume: total,
    offerCount: offers.length,
    quality:    offers[0]?.quality ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Encyclopedia  /api/v4/pt/{realm}/encyclopedia/resources/
// ---------------------------------------------------------------------------

function parseEncyclopedia(data: unknown): ResourceInfo[] | null {
  const items = Array.isArray(data) ? data : isObject(data) && Array.isArray((data as Record<string, unknown>)['results'])
    ? ((data as Record<string, unknown>)['results'] as unknown[])
    : null;
  if (!items) return null;

  return items
    .map(parseResourceInfo)
    .filter((r): r is ResourceInfo => r !== null);
}

function parseResourceInfo(raw: unknown): ResourceInfo | null {
  if (!isObject(raw)) return null;
  const r = raw as Record<string, unknown>;
  return {
    id:           asNumber(r['id']),
    name:         asString(r['name'] ?? r['db_letter'] ?? ''),
    kind:         asString(r['kind'] ?? r['category'] ?? ''),
    db_letter:    asString(r['db_letter'] ?? ''),
    image:        asString(r['image'] ?? r['icon'] ?? ''),
    tier:         asNumber(r['tier'] ?? r['level'] ?? 0),
    transport:    asNumber(r['transport'] ?? 0),
    producedFrom: parseIdArray(r['produced_from'] ?? r['inputs'] ?? []),
  };
}

// ---------------------------------------------------------------------------
// Retail Info  /api/v4/{realm}/resources-retail-info/
// ---------------------------------------------------------------------------

function parseRetailInfo(data: unknown): ResourceInfo[] | null {
  if (!isObject(data)) return null;
  // Retail info is an object keyed by resource ID
  const entries = Object.entries(data as Record<string, unknown>);
  return entries
    .map(([id, value]) => {
      if (!isObject(value)) return null;
      const v = value as Record<string, unknown>;
      return {
        id:           Number(id),
        name:         asString(v['name'] ?? id),
        kind:         asString(v['kind'] ?? ''),
        db_letter:    asString(v['db_letter'] ?? ''),
        image:        asString(v['image'] ?? ''),
        tier:         asNumber(v['tier'] ?? 0),
        transport:    asNumber(v['transport'] ?? 0),
        producedFrom: [],
      } satisfies ResourceInfo;
    })
    .filter((r): r is ResourceInfo => r !== null);
}

// ---------------------------------------------------------------------------
// SimcoTools Resources  simcotools.app/api/v3/resources
// ---------------------------------------------------------------------------

function parseSimcoToolsResources(data: unknown): ResourceInfo[] | null {
  const items = Array.isArray(data) ? data :
    isObject(data) && Array.isArray((data as Record<string, unknown>)['data'])
      ? ((data as Record<string, unknown>)['data'] as unknown[])
      : null;
  if (!items) return null;

  return items
    .map(parseResourceInfo)
    .filter((r): r is ResourceInfo => r !== null);
}

// ---------------------------------------------------------------------------
// SimcoTools Economy Phase  api.simcotools.com/v1/realms/{realm}/phases
// ---------------------------------------------------------------------------

function parseSimcoToolsPhase(data: unknown, realm: Realm): EconomyPhase | null {
  if (!isObject(data)) return null;
  const d = data as Record<string, unknown>;

  const phaseRaw = asString(
    d['phase'] ?? d['current_phase'] ?? d['economy'] ?? '',
  ).toLowerCase();

  const phaseMap: Record<string, EconomyPhase['phase']> = {
    boom:      'boom',
    growth:    'boom',
    expansion: 'boom',
    stable:    'stable',
    normal:    'stable',
    recession: 'recession',
    contraction: 'recession',
    recovery:  'recovery',
    rebound:   'recovery',
  };

  const phase = phaseMap[phaseRaw] ?? 'stable';

  const trendRaw = asString(d['trend'] ?? d['direction'] ?? '').toLowerCase();
  const trendMap: Record<string, EconomyPhase['trend']> = {
    improving: 'improving',
    up:        'improving',
    rising:    'improving',
    declining: 'declining',
    down:      'declining',
    falling:   'declining',
    stable:    'stable',
    flat:      'stable',
  };
  const trend = trendMap[trendRaw] ?? 'stable';

  return {
    realm,
    phase,
    startedAt: asString(d['started_at'] ?? d['since'] ?? new Date().toISOString()),
    trend,
  };
}

// ---------------------------------------------------------------------------
// Tiny type helpers
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = parseFloat(v); if (!isNaN(n)) return n; }
  return 0;
}

function asString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '';
}

function parseIdArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) =>
      typeof item === 'number' ? item :
      isObject(item) ? asNumber((item as Record<string, unknown>)['id']) : 0,
    )
    .filter((n) => n > 0);
}

export const responseParser = new ResponseParser();
