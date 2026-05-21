import { defineConfig } from 'vite';
import react            from '@vitejs/plugin-react';
import { resolve }      from 'path';

/**
 * SC Analytics Platform — Vite Build Config
 *
 * Produces a Chrome MV3-compatible extension bundle:
 *   dist/background/service-worker.js
 *   dist/content/index.js
 *   popup.html (served from extension root)
 */
export default defineConfig({
  plugins: [react()],

  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },

  build: {
    outDir:        'dist',
    emptyOutDir:   true,
    sourcemap:     process.env.NODE_ENV !== 'production',
    minify:        process.env.NODE_ENV === 'production',
    target:        'esnext',

    rollupOptions: {
      input: {
        // Background service worker
        'background/service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        // Content script
        'content/index':            resolve(__dirname, 'src/content/index.ts'),
        // Popup
        popup:                      resolve(__dirname, 'popup.html'),
      },

      output: {
        // Each entry gets its own flat file (no chunking that MV3 can’t handle)
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',

        // Keep popup code separate from background
        manualChunks: (id: string) => {
          if (id.includes('node_modules/react')) return 'vendor-react';
          if (id.includes('node_modules'))       return 'vendor';
          return undefined;
        },
      },
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
