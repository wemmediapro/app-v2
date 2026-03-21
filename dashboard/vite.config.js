import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/** Même variable que l’app passagers : .env à la racine du monorepo */
const DEFAULT_DEV_PROXY = 'http://localhost:3000';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');
  const proxyTarget = (env.DEV_PROXY_TARGET || DEFAULT_DEV_PROXY).replace(/\/$/, '');
  const analyzeBundle = process.env.ANALYZE === '1';
  const cdnBase = (env.VITE_DASHBOARD_ASSET_BASE || env.VITE_ASSET_BASE || '').trim();
  const dashboardBase = cdnBase === '' ? '/dashboard/' : cdnBase.endsWith('/') ? cdnBase : `${cdnBase}/`;
  const isVitest = Boolean(process.env.VITEST);

  return {
    base: dashboardBase,
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: [path.resolve(__dirname, 'src/tests/setup.js')],
      include: ['src/**/*.test.{js,jsx}'],
    },
    plugins: [
      ...(isVitest
        ? []
        : [
            {
              name: 'gnv-dashboard-proxy-log',
              configureServer() {
                console.log(`[Vite dashboard] Proxy → backend: ${proxyTarget}`);
              },
            },
          ]),
      react(),
      ...(analyzeBundle
        ? [
            visualizer({
              filename: 'dist/stats.html',
              gzipSize: true,
              brotliSize: true,
              open: true,
            }),
          ]
        : []),
    ],
    server: {
      port: 5174,
      host: true,
      strictPort: true,
      allowedHosts: ['.ngrok-free.dev', '.trycloudflare.com', 'travelstream.fr', 'www.travelstream.fr'],
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true,
          timeout: 600000, // 10 min — streaming vidéo/audio longue durée
        },
        '/socket.io': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: 'hidden', // source maps générés mais non exposés au navigateur (sécurité)
    },
    optimizeDeps: {
      force: true, // Force la réoptimisation des dépendances
      include: ['react', 'react-dom', 'react-router-dom', 'axios', 'react-hot-toast'],
    },
  };
});
