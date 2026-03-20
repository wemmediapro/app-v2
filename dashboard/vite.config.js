import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

/** Même variable que l’app passagers : .env à la racine du monorepo */
const DEFAULT_DEV_PROXY = 'http://localhost:3000'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '')
  const proxyTarget = (env.DEV_PROXY_TARGET || DEFAULT_DEV_PROXY).replace(/\/$/, '')

  return {
    base: '/dashboard/', // Servi sous http://domaine.com/dashboard/
    plugins: [
      {
        name: 'gnv-dashboard-proxy-log',
        configureServer() {
          console.log(`[Vite dashboard] Proxy → backend: ${proxyTarget}`)
        },
      },
      react(),
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
  }
})
