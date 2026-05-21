/**
 * SC Analytics Platform — Number & Date Formatters
 */

/** Format a number as a compact currency string: 1234567 → $1.23M */
export function formatCurrency(value: number, decimals = 2): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(decimals)}M`;
  if (value >= 1_000)     return `$${(value / 1_000).toFixed(decimals)}K`;
  return `$${value.toFixed(decimals)}`;
}

/** Format a percentage: 0.142 → +14.2% */
export function formatPct(value: number, showSign = true): string {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

/** Format a score 0–1 as 0–100 with label: 0.87 → "87%" */
export function formatScore(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Format relative time: "2 min ago", "just now" */
export function formatRelativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60)        return 'just now';
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Clamp a number to [min, max] */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
