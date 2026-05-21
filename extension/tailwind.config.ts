import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.{ts,tsx}',
    './popup.html',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'sc-bg':             'var(--sc-bg)',
        'sc-surface':        'var(--sc-surface)',
        'sc-surface-offset': 'var(--sc-surface-offset)',
        'sc-border':         'var(--sc-border)',
        'sc-text':           'var(--sc-text)',
        'sc-text-muted':     'var(--sc-text-muted)',
        'sc-text-faint':     'var(--sc-text-faint)',
        'sc-accent':         'var(--sc-accent)',
        'sc-green':          'var(--sc-green)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'flash-green': 'flash-green 0.7s ease-out',
        'flash-red':   'flash-red 0.7s ease-out',
      },
      keyframes: {
        'flash-green': {
          '0%':   { backgroundColor: 'rgba(16, 185, 129, 0.18)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'flash-red': {
          '0%':   { backgroundColor: 'rgba(248, 113, 113, 0.18)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
