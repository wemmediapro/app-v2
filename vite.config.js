import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
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
      includeAssets: ['favicon.ico', '*.svg'],
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
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23264FFF" width="100" height="100" rx="20"/><text x="50" y="72" font-size="60" text-anchor="middle" fill="white">🚢</text></svg>',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
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
          // Cache des médias (vidéo MP4, HLS playlist+segments, audio, images) — CacheFirst, 14 jours (offline 1000+ users)
          {
            urlPattern: /\/uploads\/(videos|videos_hls|audio|images)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gnv-offline-media',
              expiration: { maxEntries: 180, maxAgeSeconds: 14 * 24 * 60 * 60 },
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
        timeout: 300000,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.error('[Vite proxy stream]', req.method, req.url, '→', err.message || err.code || err);
          });
        },
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 30000,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.error('[Vite proxy]', req.method, req.url, '→', err.message || err.code || err);
          });
        },
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 0, // Pas de timeout pour le streaming audio/vidéo (connexion longue)
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
