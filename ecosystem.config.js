/**
 * Configuration PM2 — GNV OnBoard backend
 * Usage: pm2 start ecosystem.config.js
 *        pm2 start ecosystem.config.js --env production
 */
module.exports = {
  apps: [
    {
      name: 'gnv-backend',
      script: './backend/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1500M',
      kill_timeout: 30000,
      wait_ready: false,
      listen_timeout: 10000,
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
