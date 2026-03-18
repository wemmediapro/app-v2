// PM2 production config — uses the unified server.js
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
      
      // Clustering : PM2 gère le multi-process via exec_mode: 'cluster'.
      instances: process.env.CLUSTER_WORKERS || 'max',
      exec_mode: 'cluster',
      
      // Variables d'environnement (UV_THREADPOOL_SIZE pour bcrypt/IO parallèles)
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        CLUSTER_WORKERS: 'max',
        UV_THREADPOOL_SIZE: '16'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        CLUSTER_WORKERS: 'max',
        UV_THREADPOOL_SIZE: '16'
      },
      
      // Gestion mémoire
      max_memory_restart: '1G',  // Redémarre si > 1GB par instance
      
      // Gestion des redémarrages
      autorestart: true,
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
      
      // Gestion des processus (graceful shutdown 30s dans server.js → 35s pour laisser finir)
      kill_timeout: 35000,       // 5s de marge au-dessus du timeout interne
      wait_ready: true,          // Attend le signal 'ready'
      listen_timeout: 10000,     // Timeout pour écoute
      instance_var: 'INSTANCE_ID',
      
      // Optimisations Node.js (S9 : pas --optimize-for-size ni --gc-interval, contre-productifs en prod)
      node_args: ['--max-old-space-size=1024'],
      
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
    }
    // Frontend et dashboard : en production, servis en statique par Nginx (voir nginx.conf).
    // Build : npm run build (frontend → dist/), cd dashboard && npm run build (dashboard → dashboard/dist/).
    // Aucune app PM2 pour vite preview.
  ],
  
  deploy: {
    production: {
      user: process.env.DEPLOY_USER || 'deploy',
      host: (process.env.DEPLOY_HOST || 'votre-serveur.com').split(',').map((h) => h.trim()),
      ref: 'origin/main',
      repo: 'git@github.com:wemmediapro/app-v2.git',
      path: process.env.DEPLOY_PATH || '/var/www/app-v2',
      'post-deploy': 'npm install --production && npm run build && cd backend && npm install --production && cd ../dashboard && npm install --production && npm run build && cd .. && pm2 reload ecosystem.production.cjs --env production',
      'pre-setup': 'apt-get update && apt-get install -y git'
    }
  }
};
