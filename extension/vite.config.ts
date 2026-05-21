import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './manifest.json';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    crx({ manifest }),
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../shared'),
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: mode === 'development',
    minify: mode === 'production',
    rollupOptions: {
      input: {
        // Popup — React SPA
        popup: resolve(__dirname, 'src/popup/index.html'),
        // Content script — injected into simcompanies.com
        content: resolve(__dirname, 'src/content/index.ts'),
        // Background service worker
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'service-worker') return 'background/service-worker.js';
          if (chunk.name === 'content') return 'content/content.js';
          return 'popup/[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (asset) => {
          if (asset.name?.endsWith('.css')) {
            return asset.name.includes('content')
              ? 'content/overlay.css'
              : 'popup/[name][extname]';
          }
          return 'assets/[name][extname]';
        },
      },
    },
  },

  define: {
    __DEV__: mode === 'development',
    __VERSION__: JSON.stringify('0.1.0'),
  },
}));
