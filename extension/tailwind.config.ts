import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.{ts,tsx,html}',
    './popup.html',
  ],
  theme: {
    extend: {
      colors: {
        'sca-bg':      '#0d1117',
        'sca-surface': '#161b22',
        'sca-card':    '#1c2128',
        'sca-accent':  '#22d3ee',
        'sca-muted':   '#7d8590',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
