/**
 * SC Analytics Platform — Logger
 *
 * Lightweight, level-gated console wrapper.
 * All log output is prefixed with [SCA] and a timestamp for easy
 * filtering in the browser DevTools console.
 *
 * Log levels (ascending severity):
 *   debug → info → warn → error
 *
 * Default level in production builds: 'warn'
 * Default level in development builds: 'debug'
 *
 * Override at runtime:
 *   import { log } from './logger';
 *   log.setLevel('debug');
 *
 * Silence all output:
 *   log.setLevel('silent');
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug:  0,
  info:   1,
  warn:   2,
  error:  3,
  silent: 4,
};

const PREFIX = '[SCA]';

function ts(): string {
  return new Date().toISOString().slice(11, 23); // HH:mm:ss.mmm
}

class Logger {
  private level: LogLevel;

  constructor() {
    // Detect build mode via manifest or a compile-time constant.
    // Falls back to 'warn' if neither is available.
    this.level = this.detectLevel();
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  debug(...args: unknown[]): void {
    if (this.allows('debug')) console.debug(PREFIX, ts(), ...args);
  }

  info(...args: unknown[]): void {
    if (this.allows('info')) console.info(PREFIX, ts(), ...args);
  }

  warn(...args: unknown[]): void {
    if (this.allows('warn')) console.warn(PREFIX, ts(), ...args);
  }

  error(...args: unknown[]): void {
    if (this.allows('error')) console.error(PREFIX, ts(), ...args);
  }

  /** Log a group of related values (collapsed by default). */
  group(label: string, ...args: unknown[]): void {
    if (!this.allows('debug')) return;
    console.groupCollapsed(PREFIX, ts(), label);
    for (const a of args) console.log(a);
    console.groupEnd();
  }

  /** Time a synchronous operation and log the result. */
  time<T>(label: string, fn: () => T): T {
    const start  = performance.now();
    const result = fn();
    const ms     = (performance.now() - start).toFixed(2);
    this.debug(`${label} took ${ms}ms`);
    return result;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private allows(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.level];
  }

  private detectLevel(): LogLevel {
    // If running as a Chrome extension, check manifest version comment
    // or a __DEV__ flag injected by the bundler.
    try {
      // @ts-expect-error — __DEV__ is injected by esbuild/vite in dev builds
      if (typeof __DEV__ !== 'undefined' && __DEV__) return 'debug';
    } catch { /* not defined */ }
    return 'warn';
  }
}

export const log = new Logger();
