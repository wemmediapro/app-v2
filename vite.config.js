import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.js',
    include: ['src/tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['node_modules', 'dist', 'tests/**', 'backend/**'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Une seule instance de React pour éviter "Invalid hook call" / useState null (useShop, etc.)
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 } },
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
        ],
      },
    }),
  ],
  build: {
    assetsDir: 'assets',
    chunkSizeWarningLimit: 500,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/')) return 'react-vendor';
            if (id.includes('react-router-dom')) return 'react-router';
            if (id.includes('framer-motion')) return 'framer-motion';
            if (id.includes('lucide-react')) return 'lucide-react';
            if (id.includes('socket.io-client')) return 'socket.io';
            if (id.includes('axios')) return 'axios';
            if (id.includes('hls.js')) return 'hls';
          }
        },
      },
    },
  },
  server: {
    host: '0.0.0.0', // Écoute sur toutes les interfaces
    port: 5173,
    strictPort: true,
    hmr: false,
    allowedHosts: ['.ngrok-free.dev', '.ngrok.io', '.ngrok.app', '.trycloudflare.com', 'localhost'],
    cors: true,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    },
    proxy: {
      '/api/stream': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 600000, // 10 min pour streaming long
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.error('[Vite proxy stream]', req.method, req.url, '→', err.message || err.code || err);
          });
        },
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 120000, // 2 min — uploads lourds (images/vidéos) ; /api/stream et /uploads ont 10 min
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.error('[Vite proxy]', req.method, req.url, '→', err.message || err.code || err);
          });
        },
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 600000, // 10 min (aligné avec /api/stream)
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    allowedHosts: ['travelstream.fr'],
  },
  base: '/', // Assure que les chemins sont relatifs
})
