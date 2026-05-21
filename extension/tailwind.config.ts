import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './popup/**/*.{ts,tsx,html}',
    './overlays/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surface system
        surface: {
          DEFAULT: '#1c1b19',
          2: '#201f1d',
          offset: '#1d1c1a',
          dynamic: '#2d2c2a',
        },
        border: '#393836',
        divider: '#262523',
        // Text
        text: {
          DEFAULT: '#cdccca',
          muted: '#797876',
          faint: '#5a5957',
        },
        // Accent (teal)
        primary: {
          DEFAULT: '#4f98a3',
          hover: '#227f8b',
          active: '#1a626b',
          highlight: '#313b3b',
        },
        // Signal colors for market badges
        bullish: '#22c55e',
        bearish: '#ef4444',
        warning: '#f59e0b',
        volatile: '#a855f7',
        neutral: '#64748b',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-up': 'slideUp 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
