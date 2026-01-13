/**
 * PM2 Ecosystem Configuration
 * Manages all application processes on VPS
 * 
 * Note: Trading engine instances are managed dynamically by trading-engine-manager.js
 * This config only includes the base services (backend, MT5 API, and the manager itself)
 */

module.exports = {
  apps: [
    // Frontend - Serves React app via Nginx (static files)
    // Note: In production, Nginx serves static files directly from ui/dist
    // Uncomment below only if you want to run Vite preview server instead
    // {
    //   name: 'frontend',
    //   script: 'pnpm',
    //   args: '--filter ui preview --port 5173 --host 0.0.0.0',
    //   cwd: '/home/scalpingbot/app',
    //   instances: 1,
    //   exec_mode: 'fork',
    //   env: {
    //     NODE_ENV: 'production',
    //     PORT: 5173
    //   },
    //   error_file: '/home/scalpingbot/.pm2/logs/frontend-error.log',
    //   out_file: '/home/scalpingbot/.pm2/logs/frontend-out.log',
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    //   merge_logs: true,
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: '500M'
    // },
    
    // Backend API Server
    {
      name: 'backend',
      script: 'pnpm',
      args: '--filter server dev --port 5500',
      cwd: '/home/scalpingbot/app',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5500
      },
      env_file: '/home/scalpingbot/app/server/.env',
      error_file: '/home/scalpingbot/.pm2/logs/backend-error.log',
      out_file: '/home/scalpingbot/.pm2/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // Wait for database to be ready
      wait_ready: true,
      listen_timeout: 10000
    },
    
    // MT5 API Service (Python Flask) - DISABLED (MetaTrader5 is Windows-only)
    // {
    //   name: 'mt5-api',
    //   script: 'python3',
    //   args: 'mt5_api.py',
    //   cwd: '/home/scalpingbot/app/trading-engine',
    //   interpreter: '/home/scalpingbot/app/trading-engine/venv/bin/python',
    //   instances: 1,
    //   exec_mode: 'fork',
    //   env: {
    //     MT5_API_PORT: '5001',
    //     MT5_API_HOST: '127.0.0.1',
    //     DEBUG: 'false',
    //     PYTHONUNBUFFERED: '1'
    //   },
    //   env_file: '/home/scalpingbot/app/trading-engine/.env',
    //   error_file: '/home/scalpingbot/.pm2/logs/mt5-api-error.log',
    //   out_file: '/home/scalpingbot/.pm2/logs/mt5-api-out.log',
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    //   merge_logs: true,
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: '500M'
    // },
    
    // Trading Engine Manager
    // This process manages all trading engine instances dynamically
    {
      name: 'trading-engine-manager',
      script: 'node',
      args: 'deployment/trading-engine-manager.cjs',
      cwd: '/home/scalpingbot/app',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      env_file: '/home/scalpingbot/app/server/.env',
      error_file: '/home/scalpingbot/.pm2/logs/trading-engine-manager-error.log',
      out_file: '/home/scalpingbot/.pm2/logs/trading-engine-manager-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      // Restart on crash
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 5000
    }
    
    // Note: Individual trading engine instances are created dynamically by trading-engine-manager.js
    // Each instance follows this template:
    // {
    //   name: 'trading-engine-{user_id}-{mt5_account_id}',
    //   script: 'python3',
    //   args: ['-m', 'src.main'],
    //   cwd: '/home/scalpingbot/app/trading-engine',
    //   interpreter: '/home/scalpingbot/app/trading-engine/venv/bin/python',
    //   instances: 1,
    //   exec_mode: 'fork',
    //   env: {
    //     TRADING_ENGINE_API_URL: 'http://localhost:5500',
    //     TRADING_ENGINE_API_KEY: '<from-env>',
    //     TRADING_ENGINE_USER_ID: '<user-id>',
    //     TRADING_ENGINE_MT5_ACCOUNT_ID: '<mt5-account-id>',
    //     DATABASE_URL: '<from-env>',
    //     MT5_SYMBOL: 'XAUUSD',
    //     PYTHONUNBUFFERED: '1'
    //   },
    //   error_file: '/home/scalpingbot/.pm2/logs/trading-engine-{user_id}-{mt5_account_id}-error.log',
    //   out_file: '/home/scalpingbot/.pm2/logs/trading-engine-{user_id}-{mt5_account_id}-out.log',
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    //   merge_logs: true,
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: '1G',
    //   min_uptime: '10s',
    //   max_restarts: 10,
    //   restart_delay: 5000
    // }
  ]
};

