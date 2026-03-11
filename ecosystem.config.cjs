module.exports = {
  apps: [
    {
      name: 'gnv-backend',
      script: './backend/server.js',
      instances: process.env.CLUSTER_WORKERS || 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Optimisations pour la production - 2000 connexions
      max_memory_restart: '2G', // Plus de mémoire pour gérer plus de connexions
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      // Optimisations Node.js
      node_args: '--max-old-space-size=2048', // 2GB heap par worker
      // Kill timeout pour arrêt propre
      kill_timeout: 10000,
      // Logs
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Monitoring
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.log'],
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      // Variables d'environnement
      instance_var: 'INSTANCE_ID'
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
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      watch: false
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
      error_file: './logs/dashboard-error.log',
      out_file: './logs/dashboard-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      watch: false
    }
  ]
};
