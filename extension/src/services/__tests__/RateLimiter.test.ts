/**
 * Unit tests — RateLimiter
 * Run with: npx vitest run
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '../RateLimiter';

const SC_URL   = 'https://www.simcompanies.com/api/v2/market/1';
const ST_URL   = 'https://api.simcotools.com/v1/realms/0/phases';
const OTHER_URL = 'https://example.com/api/data';

describe('RateLimiter', () => {
  let rl: RateLimiter;

  beforeEach(() => {
    rl = new RateLimiter();
  });

  it('allows requests up to capacity', () => {
    // SC bucket: capacity 10
    for (let i = 0; i < 10; i++) {
      expect(rl.tryConsume(SC_URL)).toBe(true);
    }
  });

  it('suppresses requests over capacity', () => {
    for (let i = 0; i < 10; i++) rl.tryConsume(SC_URL);
    expect(rl.tryConsume(SC_URL)).toBe(false);
  });

  it('uses tighter capacity for SimcoTools', () => {
    for (let i = 0; i < 5; i++) {
      expect(rl.tryConsume(ST_URL)).toBe(true);
    }
    expect(rl.tryConsume(ST_URL)).toBe(false);
  });

  it('uses default capacity for unknown hosts', () => {
    for (let i = 0; i < 20; i++) rl.tryConsume(OTHER_URL);
    expect(rl.tryConsume(OTHER_URL)).toBe(false);
  });

  it('retryAfterMs returns 0 when token available', () => {
    expect(rl.retryAfterMs(SC_URL)).toBe(0);
  });

  it('retryAfterMs returns > 0 when exhausted', () => {
    for (let i = 0; i < 10; i++) rl.tryConsume(SC_URL);
    expect(rl.retryAfterMs(SC_URL)).toBeGreaterThan(0);
  });

  it('tokenCount reflects consumed tokens', () => {
    rl.tryConsume(SC_URL);
    rl.tryConsume(SC_URL);
    expect(rl.tokenCount(SC_URL)).toBe(8);
  });

  it('reset clears all buckets', () => {
    for (let i = 0; i < 10; i++) rl.tryConsume(SC_URL);
    rl.reset();
    expect(rl.tryConsume(SC_URL)).toBe(true);
  });
});
