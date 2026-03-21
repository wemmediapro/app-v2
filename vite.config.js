import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';

/** Origine du backend Express en dev (proxy Vite). Si le port 3000 est pris par un autre projet, définir DEV_PROXY_TARGET dans .env (ex. http://localhost:3001). */
const DEFAULT_DEV_PROXY = 'http://localhost:3000';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = (env.DEV_PROXY_TARGET || DEFAULT_DEV_PROXY).replace(/\/$/, '');
  const analyzeBundle = process.env.ANALYZE === '1';
  const assetBase = (env.VITE_ASSET_BASE || '/').trim();
  const viteBase = assetBase === '' || assetBase === '/' ? '/' : assetBase.endsWith('/') ? assetBase : `${assetBase}/`;

  /** App shell hors ligne (SPA) — aligné sur `base` Vite. */
  const pwaNavigateFallback = viteBase === '/' ? '/index.html' : `${viteBase.replace(/\/$/, '')}/index.html`;
  /** Préfixe des chunks Vite dans l’URL (pour runtimeCaching SWR). */
  const pwaAssetsPathPrefix = viteBase === '/' ? '/assets/' : `${viteBase.replace(/\/$/, '')}/assets/`;

  return {
    base: viteBase,
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/tests/setup.js',
      include: ['src/tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
      exclude: ['node_modules', 'dist', 'tests/**', 'backend/**', '**/*.bench.*'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'html'],
      },
      benchmark: {
        include: ['src/tests/**/*.bench.{js,jsx,ts,tsx}'],
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'],
      // hls.js : import dynamique → Vite le pré-bundle en deps/hls__js.js ; après restart / cache périmé le
      // navigateur peut garder une vieille URL → 504 « Outdated Optimize Dep ». Exclure du pré-bundle : le
      // paquet est servi en ESM direct (dist/hls.mjs), sans artefact deps versionné.
      exclude: ['hls.js'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      // Une seule instance de React pour éviter "Invalid hook call" / useState null (useShop, etc.)
      dedupe: ['react', 'react-dom'],
    },
    plugins: [
      {
        name: 'gnv-dev-proxy-log',
        configureServer() {
          console.log(`[Vite] Proxy /api (dont /api/v1), /uploads, /socket.io → ${proxyTarget}`);
        },
      },
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false, // On enregistre le SW explicitement dans main.jsx
        includeAssets: ['favicon.ico', '*.svg', 'icons/*.png'],
        manifest: {
          name: 'GNV OnBoard',
          short_name: 'GNV OnBoard',
          description: 'Portail des services à bord. Fonctionne hors ligne.',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#264FFF',
          orientation: 'portrait-primary',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          /** Précachage build : webp / webmanifest / woff, chunks lazy inclus. */
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,woff,webmanifest}'],
          /** Navigation hors ligne → index (routes React). Hors API, Socket.io et médias directs. */
          navigateFallback: pwaNavigateFallback,
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/socket\.io/,
            new RegExp(`^${viteBase === '/' ? '' : viteBase.replace(/\/$/, '')}/uploads/`, 'i'),
            /\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|mp4|webm|m3u8|ts|mp3|wav|ogg)$/i,
          ],
          // Handlers Background Sync + sync file hors ligne (voir public/service-worker.js)
          importScripts: ['service-worker.js'],
          runtimeCaching: [
            // Jamais de cache pour le transport Socket.io (évite états incohérents).
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/socket.io'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
              handler: 'CacheFirst',
              options: { cacheName: 'google-fonts', expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 } },
            },
            // Mise à jour en arrière-plan des chunks JS/CSS (complément du précachage Workbox).
            {
              urlPattern: ({ request, url }) =>
                url.pathname.startsWith(pwaAssetsPathPrefix) &&
                /\.(js|css)$/i.test(url.pathname) &&
                (request.destination === 'script' || request.destination === 'style'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'gnv-assets-swr-v1',
                expiration: { maxEntries: 80, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
            // Cache des réponses API (NetworkFirst) — après 1ère visite en ligne, données disponibles hors ligne
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'gnv-api-cache-v2',
                networkTimeoutSeconds: 15,
                expiration: { maxEntries: 150, maxAgeSeconds: 48 * 60 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
            // Cache des médias (vidéo MP4, HLS, audio, images) — CacheFirst, 7j. Pour invalider après mise à jour contenu : incrémenter cacheName (ex. gnv-offline-media-v3).
            {
              urlPattern: /\/uploads\/(videos|videos_hls|audio|images)\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gnv-offline-media-v2',
                expiration: { maxEntries: 180, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200, 206] },
              },
            },
            // Ressources publiques (logo, loading-init, manifest) si hors précachage.
            {
              urlPattern: ({ url }) =>
                url.pathname.endsWith('.webmanifest') ||
                url.pathname.endsWith('/loading-init.js') ||
                url.pathname.endsWith('/logo-gnv.png'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'gnv-public-static-v1',
                expiration: { maxEntries: 16, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
        },
      }),
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
    build: {
      assetsDir: 'assets',
      /** Navigateurs ES2020+ : moins de transpilation → bundle légèrement plus petit. */
      target: 'es2020',
      // hls.js reste ~520 ko minifié dans son chunk async ; éviter un faux positif sur la limite par défaut (500).
      chunkSizeWarningLimit: 600,
      reportCompressedSize: true,
      rollupOptions: {
        output: {
          /**
           * Chunks vendors nommés (pas de fourre-tout `vendor` : évite les cycles vendor ↔ react).
           * `web-vitals` reste dans le graphe par défaut (souvent lié à Sentry) pour éviter sentry ↔ web-vitals.
           */
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('\\react\\')) {
              return 'react-vendor';
            }
            if (id.includes('react-router')) return 'react-router';
            if (id.includes('framer-motion')) return 'framer-motion';
            if (id.includes('lucide-react')) return 'lucide-react';
            if (id.includes('socket.io-client')) return 'socket.io';
            if (id.includes('axios')) return 'axios';
            if (id.includes('hls.js')) return 'hls';
            if (id.includes('dompurify') || id.includes('isomorphic-dompurify')) return 'dompurify';
            if (id.includes('idb')) return 'idb';
            if (id.includes('@sentry')) return 'sentry-vendor';
            if (id.includes('workbox-')) return 'workbox';
          },
        },
      },
    },
    server: {
      host: '0.0.0.0', // Écoute sur toutes les interfaces
      port: 5173,
      strictPort: true,
      hmr: true, // Réactivé en dev (désactivé automatiquement en build)
      allowedHosts: ['.ngrok-free.dev', '.ngrok.io', '.ngrok.app', '.trycloudflare.com', 'localhost'],
      cors: true,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
      proxy: {
        '/api/stream': {
          target: proxyTarget,
          changeOrigin: true,
          timeout: 600000, // 10 min pour streaming long
          configure: (proxy) => {
            proxy.on('error', (err, req, res) => {
              console.error('[Vite proxy stream]', req.method, req.url, '→', err.message || err.code || err);
            });
          },
        },
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          timeout: 120000, // 2 min — uploads lourds (images/vidéos) ; /api/stream et /uploads ont 10 min
          configure: (proxy) => {
            proxy.on('error', (err, req, res) => {
              // Quand le backend est down (ECONNREFUSED), GET /api/notifications → 200 + liste vide pour éviter 500 en console
              const isGetNotifications =
                req.method === 'GET' && /^\/api(?:\/v1)?\/notifications(\?|$)/.test(req.url || '');
              if (isGetNotifications && res && !res.headersSent) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ data: [], total: 0, page: 1, limit: 20 }));
                return;
              }
              console.error('[Vite proxy]', req.method, req.url, '→', err.message || err.code || err);
            });
          },
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true,
          timeout: 600000, // 10 min (aligné avec /api/stream)
          configure: (proxy) => {
            proxy.on('error', (err, req, res) => {
              console.error('[Vite proxy /uploads]', req.method, req.url, '→', err.message || err.code || err);
              if (res && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(
                  JSON.stringify({
                    message:
                      'Backend injoignable pour les médias /uploads. Lancez le serveur backend (souvent port 3000 depuis le dossier backend) ou définissez DEV_PROXY_TARGET dans .env à la racine du front.',
                    code: 'UPLOADS_PROXY_TARGET_DOWN',
                  })
                );
              }
            });
          },
        },
        '/socket.io': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    preview: {
      allowedHosts: ['travelstream.fr'],
    },
  };
});
