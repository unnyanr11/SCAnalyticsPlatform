/**
 * Lightweight in-memory store for overlay metrics.
 * No React, no Zustand — safe to import in the content script layer.
 */
import type { OverlayMetrics } from './overlayTypes';

type Listener = (metrics: OverlayMetrics) => void;

class OverlayStore {
  private data = new Map<number, OverlayMetrics>();
  private listeners = new Map<number, Set<Listener>>();
  private wildcards = new Set<Listener>();

  set(metrics: OverlayMetrics): void {
    this.data.set(metrics.productId, metrics);
    this.listeners.get(metrics.productId)?.forEach((fn) => fn(metrics));
    this.wildcards.forEach((fn) => fn(metrics));
  }

  get(productId: number): OverlayMetrics | undefined {
    return this.data.get(productId);
  }

  getAll(): OverlayMetrics[] {
    return Array.from(this.data.values());
  }

  /** Subscribe to updates for a specific product. */
  subscribe(productId: number, fn: Listener): () => void {
    if (!this.listeners.has(productId)) {
      this.listeners.set(productId, new Set());
    }
    this.listeners.get(productId)!.add(fn);
    return () => this.listeners.get(productId)?.delete(fn);
  }

  /** Subscribe to all product updates. */
  subscribeAll(fn: Listener): () => void {
    this.wildcards.add(fn);
    return () => this.wildcards.delete(fn);
  }
}

export const overlayStore = new OverlayStore();
