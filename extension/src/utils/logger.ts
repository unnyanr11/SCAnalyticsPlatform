/**
 * SC Analytics Platform — Logger
 *
 * Structured console logger with level filtering.
 * In production builds, only warnings and errors are emitted.
 */

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function emit(level: LogLevel, ...args: unknown[]): void {
  if (!isDev && (level === 'debug' || level === 'info')) return;
  const prefix = `[SCA ${level.toUpperCase()}]`;
  switch (level) {
    case 'debug': console.debug(prefix, ...args); break;
    case 'info':  console.info(prefix, ...args);  break;
    case 'warn':  console.warn(prefix, ...args);  break;
    case 'error': console.error(prefix, ...args); break;
  }
}

export const log = {
  debug: (...args: unknown[]) => emit('debug', ...args),
  info:  (...args: unknown[]) => emit('info',  ...args),
  warn:  (...args: unknown[]) => emit('warn',  ...args),
  error: (...args: unknown[]) => emit('error', ...args),
};
