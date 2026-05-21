/**
 * Unit tests — SchemaValidator
 * Run with: npx vitest run
 */

import { describe, it, expect } from 'vitest';
import {
  validateMarketOffer,
  validateMarketSnapshot,
  validateResourceInfo,
  validateEconomyPhase,
  isSaneParsedResponse,
} from '../SchemaValidator';

describe('validateMarketOffer', () => {
  const valid = {
    resourceId: 1, companyId: 42, price: 100, quantity: 500,
    quality: 0, observedAt: Date.now(), realm: 0,
  };

  it('accepts a valid offer', () => {
    expect(validateMarketOffer(valid).valid).toBe(true);
  });

  it('rejects missing resourceId', () => {
    const r = validateMarketOffer({ ...valid, resourceId: undefined });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('rejects negative price', () => {
    const r = validateMarketOffer({ ...valid, price: -5 });
    expect(r.valid).toBe(false);
  });

  it('rejects invalid quality tier', () => {
    const r = validateMarketOffer({ ...valid, quality: 99 });
    expect(r.valid).toBe(false);
  });
});

describe('validateMarketSnapshot', () => {
  const valid = {
    resourceId: 1, realm: 0, timestamp: Date.now(),
    lowestAsk: 90, highestAsk: 110, vwap: 100,
    totalSupply: 1000, offerCount: 5,
    demandScore: 0.6, priceVolatility: 5.2,
  };

  it('accepts a valid snapshot', () => {
    expect(validateMarketSnapshot(valid).valid).toBe(true);
  });

  it('rejects lowestAsk > highestAsk', () => {
    const r = validateMarketSnapshot({ ...valid, lowestAsk: 120, highestAsk: 90 });
    expect(r.valid).toBe(false);
  });
});

describe('validateEconomyPhase', () => {
  const valid = {
    realm: 0, name: 'boom', code: 1, multiplier: 1.2, observedAt: Date.now(),
  };

  it('accepts valid phase', () => {
    expect(validateEconomyPhase(valid).valid).toBe(true);
  });

  it('rejects unknown phase name', () => {
    const r = validateEconomyPhase({ ...valid, name: 'hyperinflation' });
    expect(r.valid).toBe(false);
  });
});

describe('isSaneParsedResponse', () => {
  it('returns true for non-null object', () => {
    expect(isSaneParsedResponse({ a: 1 })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isSaneParsedResponse(null)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSaneParsedResponse('')).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(isSaneParsedResponse([])).toBe(false);
  });
});
