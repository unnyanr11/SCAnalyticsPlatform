/**
 * SC Analytics Platform — Schema Validator
 *
 * Lightweight runtime validation for parsed domain objects.
 * Uses plain predicate functions instead of a heavy schema library
 * to keep the extension bundle minimal.
 *
 * Returns a ValidationResult with:
 *   valid   — whether the object passes all required checks
 *   errors  — list of specific field-level problems found
 *
 * Failures are warnings, not exceptions — the system stays live.
 */

import type { MarketOffer, MarketSnapshot, ResourceInfo, EconomyPhase } from '../types/market';

export interface ValidationResult {
  valid:  boolean;
  errors: string[];
}

const PASS: ValidationResult = { valid: true, errors: [] };

function fail(...errors: string[]): ValidationResult {
  return { valid: false, errors };
}

function merge(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors);
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// MarketOffer
// ---------------------------------------------------------------------------

export function validateMarketOffer(o: unknown): ValidationResult {
  if (!o || typeof o !== 'object') return fail('MarketOffer must be an object');
  const offer = o as Partial<MarketOffer>;
  const errors: string[] = [];

  if (typeof offer.price    !== 'number' || offer.price    <= 0) errors.push('price must be a positive number');
  if (typeof offer.quantity !== 'number' || offer.quantity <= 0) errors.push('quantity must be a positive number');
  if (typeof offer.quality  !== 'number' || offer.quality  < 0 || offer.quality > 4)
    errors.push('quality must be 0–4');
  if (typeof offer.kind     !== 'number') errors.push('kind (resource ID) must be a number');

  return errors.length ? { valid: false, errors } : PASS;
}

// ---------------------------------------------------------------------------
// MarketSnapshot
// ---------------------------------------------------------------------------

export function validateMarketSnapshot(s: unknown): ValidationResult {
  if (!s || typeof s !== 'object') return fail('MarketSnapshot must be an object');
  const snap = s as Partial<MarketSnapshot>;
  const errors: string[] = [];

  if (typeof snap.resourceId !== 'number' || snap.resourceId <= 0) errors.push('resourceId must be a positive number');
  if (typeof snap.minPrice   !== 'number' || snap.minPrice   <  0) errors.push('minPrice must be >= 0');
  if (typeof snap.maxPrice   !== 'number' || snap.maxPrice   <  0) errors.push('maxPrice must be >= 0');
  if (typeof snap.avgPrice   !== 'number' || snap.avgPrice   <  0) errors.push('avgPrice must be >= 0');
  if (snap.minPrice !== undefined && snap.maxPrice !== undefined && snap.minPrice > snap.maxPrice)
    errors.push('minPrice must be <= maxPrice');
  if (typeof snap.offerCount !== 'number' || snap.offerCount < 0) errors.push('offerCount must be >= 0');
  if (typeof snap.timestamp  !== 'number' || snap.timestamp  <= 0) errors.push('timestamp must be a positive epoch ms');
  if (snap.realm !== 0 && snap.realm !== 1) errors.push('realm must be 0 or 1');

  return errors.length ? { valid: false, errors } : PASS;
}

// ---------------------------------------------------------------------------
// ResourceInfo
// ---------------------------------------------------------------------------

export function validateResourceInfo(r: unknown): ValidationResult {
  if (!r || typeof r !== 'object') return fail('ResourceInfo must be an object');
  const res = r as Partial<ResourceInfo>;
  const errors: string[] = [];

  if (typeof res.id   !== 'number' || res.id   <= 0) errors.push('id must be a positive number');
  if (typeof res.name !== 'string' || !res.name)     errors.push('name must be a non-empty string');
  if (!Array.isArray(res.producedFrom))               errors.push('producedFrom must be an array');

  return errors.length ? { valid: false, errors } : PASS;
}

// ---------------------------------------------------------------------------
// EconomyPhase
// ---------------------------------------------------------------------------

const VALID_PHASES  = new Set(['boom', 'stable', 'recession', 'recovery']);
const VALID_TRENDS  = new Set(['improving', 'stable', 'declining']);

export function validateEconomyPhase(p: unknown): ValidationResult {
  if (!p || typeof p !== 'object') return fail('EconomyPhase must be an object');
  const phase = p as Partial<EconomyPhase>;
  const errors: string[] = [];

  if (!VALID_PHASES.has(phase.phase ?? ''))  errors.push(`phase must be one of: ${[...VALID_PHASES].join(', ')}`);
  if (!VALID_TRENDS.has(phase.trend ?? ''))  errors.push(`trend must be one of: ${[...VALID_TRENDS].join(', ')}`);
  if (phase.realm !== 0 && phase.realm !== 1) errors.push('realm must be 0 or 1');

  return errors.length ? { valid: false, errors } : PASS;
}

// ---------------------------------------------------------------------------
// Bulk validators
// ---------------------------------------------------------------------------

export function validateMarketOffers(offers: unknown[]): ValidationResult {
  const results = offers.map((o, i) => {
    const r = validateMarketOffer(o);
    return r.valid ? PASS : { valid: false, errors: r.errors.map((e) => `[${i}] ${e}`) };
  });
  return merge(...results);
}

export function validateResourceInfoArray(resources: unknown[]): ValidationResult {
  const results = resources.map((r, i) => {
    const vr = validateResourceInfo(r);
    return vr.valid ? PASS : { valid: false, errors: vr.errors.map((e) => `[${i}] ${e}`) };
  });
  return merge(...results);
}

// ---------------------------------------------------------------------------
// Generic raw-data sanity check (pre-parse gate)
// ---------------------------------------------------------------------------

/** Quick check: is this a non-empty array or object? Rejects nulls, empty strings, etc. */
export function isSaneParsedResponse(data: unknown): boolean {
  if (data === null || data === undefined) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === 'object') return Object.keys(data as object).length > 0;
  return false;
}
