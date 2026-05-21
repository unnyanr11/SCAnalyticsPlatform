/**
 * overlayManager.ts
 *
 * Central coordinator for the overlay injection system.
 *
 * Responsibilities:
 *   1. Receive DOM scan results from DomScanner.
 *   2. Decide whether to inject a badge (inline rows) or panel (detail pages).
 *   3. Create Shadow DOM mounts for each anchor.
 *   4. Maintain a registry of active overlay mounts.
 *   5. Update React props when new metrics arrive via message bus.
 *   6. Tear down mounts when elements leave the DOM.
 */

import React from 'react';
import { detectPage } from './pageDetector';
import { createShadowMount } from './shadowMount';
import { DomScanner } from './domScanner';
import type { ScanResult } from './domScanner';
import { OverlayBadge } from './components/OverlayBadge';
import { OverlayPanel } from './components/OverlayPanel';
import type { OverlayMetrics, OverlayMessage } from './types';
import type { ShadowMount } from './shadowMount';

interface MountRecord {
  mount: ShadowMount;
  metrics: OverlayMetrics;
  variant: 'badge' | 'panel';
}

export class OverlayManager {
  private readonly registry = new Map<number, MountRecord>();
  private readonly scanner: DomScanner;
  private metricsCache = new Map<number, OverlayMetrics>();

  constructor() {
    this.scanner = new DomScanner(
      this.handleFound.bind(this),
      this.handleRemoved.bind(this),
    );
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  start(): void {
    this.scanner.start();
    this.listenForMessages();
  }

  stop(): void {
    this.scanner.stop();
    for (const [, record] of this.registry) {
      record.mount.unmount();
    }
    this.registry.clear();
  }

  // ── Metrics update (called by message listener) ───────────────────────

  updateMetrics(metrics: OverlayMetrics): void {
    this.metricsCache.set(metrics.productId, metrics);

    const record = this.registry.get(metrics.productId);
    if (record) {
      record.metrics = metrics;
      this.renderInto(record);
    }
  }

  // ── DOM scanner callbacks ──────────────────────────────────────────

  private handleFound(results: ScanResult[]): void {
    const ctx = detectPage();
    const usePanel = ctx.kind === 'product' || ctx.kind === 'production';

    for (const { anchor, productId } of results) {
      if (this.registry.has(productId)) continue;

      let mount: ShadowMount;
      try {
        // Panels go after the anchor container; badges inline at end of row
        mount = createShadowMount(
          anchor,
          usePanel ? 'afterend' : 'beforeend',
        );
      } catch {
        // DOM may have mutated between scan and mount attempt — skip
        continue;
      }

      // Use cached metrics if already received from background
      const metrics = this.metricsCache.get(productId) ?? this.placeholderMetrics(productId);

      const record: MountRecord = {
        mount,
        metrics,
        variant: usePanel ? 'panel' : 'badge',
      };

      this.registry.set(productId, record);
      this.renderInto(record);
    }
  }

  private handleRemoved(productIds: number[]): void {
    for (const pid of productIds) {
      const record = this.registry.get(pid);
      if (record) {
        record.mount.unmount();
        this.registry.delete(pid);
      }
    }
  }

  // ── React rendering ───────────────────────────────────────────────

  private renderInto(record: MountRecord): void {
    const { mount, metrics, variant } = record;
    const element = variant === 'panel'
      ? React.createElement(OverlayPanel, { metrics, key: metrics.updatedAt })
      : React.createElement(OverlayBadge, { metrics, key: metrics.updatedAt });
    mount.root.render(element);
  }

  // ── Message bus ──────────────────────────────────────────────────

  private listenForMessages(): void {
    chrome.runtime.onMessage.addListener((msg: OverlayMessage) => {
      if (msg.type === 'SCA_OVERLAY_UPDATE') {
        this.updateMetrics(msg.metrics);
      } else if (msg.type === 'SCA_OVERLAY_REMOVE') {
        const record = this.registry.get(msg.productId);
        if (record) {
          record.mount.unmount();
          this.registry.delete(msg.productId);
          this.metricsCache.delete(msg.productId);
        }
      }
    });
  }

  // ── Placeholder ───────────────────────────────────────────────────

  private placeholderMetrics(productId: number): OverlayMetrics {
    return {
      productId,
      productName: `Product #${productId}`,
      profitabilityScore: 0,
      aiConfidence: 0,
      volatility: 0,
      shortageRisk: 0,
      direction: 'flat',
      momentum24h: 0,
      currentPrice: 0,
      updatedAt: Date.now(),
    };
  }
}
