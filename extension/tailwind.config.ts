import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx,html}',
    './src/popup/index.html',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // SC Analytics dark terminal palette
        sc: {
          dark:    '#0d1117',
          darker:  '#090d12',
          surface: '#161b22',
          surface2:'#1c2128',
          border:  '#30363d',
          border2: '#21262d',
          text:    '#e6edf3',
          muted:   '#8b949e',
          faint:   '#484f58',
          accent:  '#58a6ff',
          green:   '#3fb950',
          red:     '#f85149',
          yellow:  '#d29922',
          orange:  '#e3b341',
          purple:  '#bc8cff',
          teal:    '#39d353',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
      boxShadow: {
        'glow-accent': '0 0 12px rgba(88,166,255,0.25)',
        'glow-green':  '0 0 12px rgba(63,185,80,0.25)',
        'glow-red':    '0 0 12px rgba(248,81,73,0.25)',
        'panel':       '0 8px 32px rgba(0,0,0,0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':    'fadeIn 200ms ease-out',
        'slide-up':   'slideUp 250ms cubic-bezier(0.16,1,0.3,1)',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};

export default config;
