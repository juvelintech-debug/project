import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.VITE_API_TARGET || 'http://127.0.0.1:4000';

/**
 * Dev proxy: the browser only ever talks to this origin. `/api` and `/uploads`
 * are forwarded to Express here (server-side), which is what keeps the app
 * working behind a port-forwarded/remote preview where `localhost:4000` would
 * not resolve for the viewer. In production Express serves `dist/` itself and
 * the same relative paths keep working — no baseURL to change per environment.
 *
 * There is deliberately no VITE_AI_KEY / no AI URL here: the React bundle must
 * never be able to reach the model provider directly.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
    allowedHosts: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      // Signed, short-lived resume downloads — same path as production.
      '/uploads': { target: API_TARGET, changeOrigin: false },
    },
  },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
