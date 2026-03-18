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
      
      // Clustering : PM2 lance N processus server.js (exec_mode: 'cluster'). backend/cluster.js n'est pas utilisé (code mort en prod PM2).
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
    },
    // En production réelle, préférer servir dist/ via Nginx (root /path/to/dist; try_files $uri /index.html;)
    // plutôt que vite preview qui est destiné aux tests et ajoute un overhead inutile.
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
    // Idem : en prod, servir dashboard/dist via Nginx plutôt que vite preview.
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
  
  // Deploy (Q4 : remplacer les placeholders par les vraies valeurs avant utilisation)
  deploy: {
    production: {
      user: 'deploy',                    // Remplacer par l'utilisateur serveur
      host: ['votre-serveur.com'],       // Remplacer par l'hôte réel
      ref: 'origin/main',
      repo: 'git@github.com:votre-repo/gnv-app.git', // Remplacer par le repo réel
      path: '/var/www/gnv-app',           // Remplacer par le chemin de déploiement
      'post-deploy': 'npm install --production && npm run build && pm2 reload ecosystem.production.cjs --env production',
      'pre-setup': 'apt-get update && apt-get install -y git'
    }
  }
};
