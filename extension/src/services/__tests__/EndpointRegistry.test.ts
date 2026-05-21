/**
 * Unit tests — EndpointRegistry
 * Run with: npx vitest run
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EndpointRegistry } from '../EndpointRegistry';

describe('EndpointRegistry', () => {
  let registry: EndpointRegistry;

  beforeEach(() => {
    registry = new EndpointRegistry();
  });

  it('matches SC market endpoint', () => {
    const desc = registry.match('https://www.simcompanies.com/api/v2/market/42');
    expect(desc).not.toBeNull();
    expect(desc!.kind).toBe('market_offers');
  });

  it('matches SimcoTools phase endpoint', () => {
    const desc = registry.match('https://api.simcotools.com/v1/realms/0/phases');
    expect(desc).not.toBeNull();
    expect(desc!.kind).toBe('simcotools_phase');
  });

  it('returns null for unknown URLs', () => {
    expect(registry.match('https://google.com')).toBeNull();
  });

  it('shouldIntercept returns true for known URL', () => {
    expect(
      registry.shouldIntercept('https://www.simcompanies.com/api/v2/market/1'),
    ).toBe(true);
  });

  it('shouldIntercept returns false for unknown URL', () => {
    expect(registry.shouldIntercept('https://youtube.com')).toBe(false);
  });

  it('allows runtime registration', () => {
    registry.register({
      id: 'custom_test', kind: 'market_offers',
      pattern: /https?:\/\/custom\.example\.com\/market/,
      cacheTtlMs: 30_000, priority: 50, requiresAuth: false,
    });
    expect(registry.shouldIntercept('https://custom.example.com/market/data')).toBe(true);
  });

  it('allows unregistration', () => {
    registry.unregister('sc_market_v2');
    expect(
      registry.shouldIntercept('https://www.simcompanies.com/api/v2/market/1'),
    ).toBe(false);
  });
});
