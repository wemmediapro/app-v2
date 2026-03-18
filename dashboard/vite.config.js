import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/dashboard/', // Servi sous http://domaine.com/dashboard/
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    strictPort: true,
    allowedHosts: ['.ngrok-free.dev', '.trycloudflare.com', 'travelstream.fr', 'www.travelstream.fr'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 600000, // 10 min — streaming vidéo/audio longue durée
      },
      '/socket.io': {
        target: 'http://localhost:3000',
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
    include: ['react', 'react-dom', 'react-router-dom', 'axios', 'react-hot-toast']
  }
})