/**
 * Configuration PM2 pour Production - 2000 Connexions Simultanées
 * 
 * Cette configuration optimise les performances pour gérer un grand nombre
 * de connexions simultanées avec Socket.io et clustering.
 */

module.exports = {
  apps: [
    {
      name: 'gnv-backend',
      script: './backend/server.js',
      
      // Clustering - Utilise tous les cœurs CPU disponibles
      instances: process.env.CLUSTER_WORKERS || 'max',
      exec_mode: 'cluster',
      
      // Variables d'environnement
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        CLUSTER_WORKERS: 'max'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        CLUSTER_WORKERS: 'max'
      },
      
      // Gestion mémoire
      max_memory_restart: '1G',  // Redémarre si > 1GB par instance
      
      // Gestion des redémarrages
      min_uptime: '10s',         // Temps minimum avant considérer stable
      max_restarts: 10,          // Max redémarrages en 1 minute
      restart_delay: 4000,       // Délai entre redémarrages
      
      // Logs
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Monitoring
      watch: false,              // Pas de watch en production
      ignore_watch: ['node_modules', 'logs', '*.log', 'uploads'],
      
      // Gestion des processus
      kill_timeout: 5000,        // Timeout pour arrêt propre
      wait_ready: true,          // Attend le signal 'ready'
      listen_timeout: 10000,     // Timeout pour écoute
      instance_var: 'INSTANCE_ID',
      
      // Optimisations Node.js
      node_args: [
        '--max-old-space-size=1024',  // 1GB heap par instance
        '--optimize-for-size',
        '--gc-interval=100'
      ],
      
      // Variables spécifiques au clustering
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // Source maps (désactivé en production)
      source_map_support: false,
      
      // PM2 Plus (optionnel - monitoring cloud)
      // pmx: true,
      
      // Métriques
      pmx: {
        http: true,
        network: true,
        ports: true
      }
    },
    {
      name: 'gnv-frontend',
      script: 'npx',
      args: 'vite preview --host 0.0.0.0 --port 5173',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'production'
      },
      
      // Logs
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Gestion
      watch: false,
      autorestart: true,
      max_memory_restart: '500M',
      
      // Redémarrages
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 3000
    },
    {
      name: 'gnv-dashboard',
      script: 'npx',
      args: 'vite preview --host 0.0.0.0 --port 5174',
      cwd: './dashboard',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'production'
      },
      
      // Logs
      error_file: './logs/dashboard-error.log',
      out_file: './logs/dashboard-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Gestion
      watch: false,
      autorestart: true,
      max_memory_restart: '500M',
      
      // Redémarrages
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 3000
    }
  ],
  
  // Configuration globale PM2
  deploy: {
    production: {
      user: 'deploy',
      host: ['votre-serveur.com'],
      ref: 'origin/main',
      repo: 'git@github.com:votre-repo/gnv-app.git',
      path: '/var/www/gnv-app',
      'post-deploy': 'npm install --production && npm run build && pm2 reload ecosystem.production.cjs --env production',
      'pre-setup': 'apt-get update && apt-get install -y git'
    }
  }
};
