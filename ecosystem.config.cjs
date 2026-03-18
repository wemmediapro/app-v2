/**
 * Config PM2 (alias possible : ecosystem.cjs). En prod préférer ecosystem.production.cjs.
 * Clustering : script server.js + exec_mode cluster → backend/cluster.js non utilisé (code mort).
 */
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
      max_memory_restart: '2G',
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      node_args: '--max-old-space-size=2048',
      kill_timeout: 35000, // Graceful shutdown 30s dans server.js → marge 35s
      wait_ready: true,
      listen_timeout: 10000,
      instance_var: 'INSTANCE_ID',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.log']
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
