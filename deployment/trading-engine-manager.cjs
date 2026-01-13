#!/usr/bin/env node
/**
 * Trading Engine Manager
 * Dynamically manages PM2 processes for trading engines based on active users
 * 
 * This script:
 * - Queries database for active users with active MT5 accounts
 * - Spawns/stops PM2 processes for trading engines dynamically
 * - Monitors process health and restarts failed instances
 * - Handles user account activation/deactivation
 */

const pm2 = require('pm2');
const postgres = require('postgres');
const fs = require('fs').promises;
const path = require('path');

// Note: We'll query the database directly using SQL since schemas are TypeScript
// The table names are: app.users and app.mt5_accounts

// Configuration
const POLL_INTERVAL = 60000; // 60 seconds
const STATE_FILE = '/home/scalpingbot/app/deployment/.trading-engine-state.json';
const APP_DIR = '/home/scalpingbot/app';
const TRADING_ENGINE_DIR = path.join(APP_DIR, 'trading-engine');

// Load environment variables
require('dotenv').config({ path: path.join(APP_DIR, 'server', '.env') });

let dbClient = null;
let runningInstances = new Map(); // user_id -> { mt5_account_id, pm2_name, started_at }

/**
 * Initialize database connection
 */
async function initDatabase() {
  const databaseUrl = process.env.DATABASE_URL || process.env.PGDIRECT_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL or PGDIRECT_URL must be set');
  }

  dbClient = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });

  console.log('Database connection initialized');
}

/**
 * Load state from file
 */
async function loadState() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf8');
    const state = JSON.parse(data);
    runningInstances = new Map(state.instances || []);
    console.log(`Loaded state: ${runningInstances.size} instances`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error loading state:', error);
    }
    runningInstances = new Map();
  }
}

/**
 * Save state to file
 */
async function saveState() {
  try {
    const state = {
      instances: Array.from(runningInstances.entries()),
      lastUpdated: new Date().toISOString(),
    };
    await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

/**
 * Get active users with active MT5 accounts
 */
async function getActiveUsers() {
  try {
    // Query using raw SQL since schemas are TypeScript
    const result = await dbClient`
      SELECT DISTINCT ON (user_id)
        user_id,
        id as mt5_account_id
      FROM app.mt5_accounts
      WHERE is_active = true
      ORDER BY user_id, created_at DESC
    `;

    return result.map((row) => ({
      user_id: row.user_id,
      mt5_account_id: row.mt5_account_id,
    }));
  } catch (error) {
    console.error('Error fetching active users:', error);
    return [];
  }
}

/**
 * Get PM2 process name for a user
 */
function getProcessName(userId, mt5AccountId) {
  return `trading-engine-${userId.substring(0, 8)}-${mt5AccountId.substring(0, 8)}`;
}

/**
 * Start trading engine for a user
 */
async function startTradingEngine(userId, mt5AccountId) {
  const processName = getProcessName(userId, mt5AccountId);

  // Check if already running
  return new Promise((resolve, reject) => {
    pm2.describe(processName, (err, processes) => {
      if (err && err.message !== 'process or namespace not found') {
        return reject(err);
      }

      if (processes && processes.length > 0) {
        console.log(`Trading engine ${processName} already running`);
        return resolve();
      }

      // Create environment variables for this instance
      const env = {
        TRADING_ENGINE_API_URL: process.env.TRADING_ENGINE_API_URL || 'http://localhost:5500',
        TRADING_ENGINE_API_KEY: process.env.TRADING_ENGINE_API_KEY || 'trading-engine-key',
        TRADING_ENGINE_USER_ID: userId,
        TRADING_ENGINE_MT5_ACCOUNT_ID: mt5AccountId,
        DATABASE_URL: process.env.DATABASE_URL || process.env.PGDIRECT_URL,
        MT5_SYMBOL: process.env.MT5_SYMBOL || 'XAUUSD',
        PYTHONUNBUFFERED: '1',
      };

      // Start process
      pm2.start(
        {
          name: processName,
          script: 'python3',
          args: ['-m', 'src.main'],
          cwd: TRADING_ENGINE_DIR,
          interpreter: path.join(TRADING_ENGINE_DIR, 'venv', 'bin', 'python'),
          instances: 1,
          exec_mode: 'fork',
          env: env,
          error_file: `/home/scalpingbot/.pm2/logs/${processName}-error.log`,
          out_file: `/home/scalpingbot/.pm2/logs/${processName}-out.log`,
          log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
          merge_logs: true,
          autorestart: true,
          watch: false,
          max_memory_restart: '1G',
          min_uptime: '10s',
          max_restarts: 10,
          restart_delay: 5000,
        },
        (err) => {
          if (err) {
            console.error(`Error starting trading engine ${processName}:`, err);
            return reject(err);
          }

          console.log(`Started trading engine ${processName} for user ${userId}`);
          runningInstances.set(userId, {
            mt5_account_id: mt5AccountId,
            pm2_name: processName,
            started_at: new Date().toISOString(),
          });
          saveState();
          resolve();
        }
      );
    });
  });
}

/**
 * Stop trading engine for a user
 */
async function stopTradingEngine(userId) {
  const instance = runningInstances.get(userId);
  if (!instance) {
    return;
  }

  return new Promise((resolve, reject) => {
    pm2.delete(instance.pm2_name, (err) => {
      if (err && err.message !== 'process or namespace not found') {
        console.error(`Error stopping trading engine ${instance.pm2_name}:`, err);
        return reject(err);
      }

      console.log(`Stopped trading engine ${instance.pm2_name} for user ${userId}`);
      runningInstances.delete(userId);
      saveState();
      resolve();
    });
  });
}

/**
 * Check and restart failed processes
 */
async function checkProcessHealth() {
  const processes = await new Promise((resolve, reject) => {
    pm2.list((err, processes) => {
      if (err) return reject(err);
      resolve(processes);
    });
  });

  for (const [userId, instance] of runningInstances.entries()) {
    const process = processes.find((p) => p.name === instance.pm2_name);
    if (!process) {
      console.warn(`Process ${instance.pm2_name} not found in PM2, restarting...`);
      await startTradingEngine(userId, instance.mt5_account_id);
    } else if (process.pm2_env.status === 'errored' || process.pm2_env.status === 'stopped') {
      console.warn(`Process ${instance.pm2_name} is ${process.pm2_env.status}, restarting...`);
      await stopTradingEngine(userId);
      await startTradingEngine(userId, instance.mt5_account_id);
    }
  }
}

/**
 * Sync processes with database state
 */
async function syncProcesses() {
  try {
    const activeUsers = await getActiveUsers();
    const activeUserIds = new Set(activeUsers.map((u) => u.user_id));

    // Start processes for new active users
    for (const user of activeUsers) {
      const instance = runningInstances.get(user.user_id);
      if (!instance) {
        console.log(`Starting trading engine for new user: ${user.user_id}`);
        await startTradingEngine(user.user_id, user.mt5_account_id);
      } else if (instance.mt5_account_id !== user.mt5_account_id) {
        // User switched to a different MT5 account
        console.log(`Switching trading engine for user ${user.user_id} to account ${user.mt5_account_id}`);
        await stopTradingEngine(user.user_id);
        await startTradingEngine(user.user_id, user.mt5_account_id);
      }
    }

    // Stop processes for users who are no longer active
    for (const [userId, instance] of runningInstances.entries()) {
      if (!activeUserIds.has(userId)) {
        console.log(`Stopping trading engine for inactive user: ${userId}`);
        await stopTradingEngine(userId);
      }
    }

    // Check process health
    await checkProcessHealth();
  } catch (error) {
    console.error('Error syncing processes:', error);
  }
}

/**
 * Main loop
 */
async function main() {
  console.log('Starting Trading Engine Manager...');

  // Connect to PM2
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        console.error('Error connecting to PM2:', err);
        return reject(err);
      }

      console.log('Connected to PM2');

      // Initialize
      initDatabase()
        .then(() => loadState())
        .then(() => {
          // Initial sync
          syncProcesses();

          // Periodic sync
          setInterval(() => {
            syncProcesses();
          }, POLL_INTERVAL);

          console.log(`Trading Engine Manager running (polling every ${POLL_INTERVAL / 1000}s)`);
        })
        .catch((err) => {
          console.error('Error initializing:', err);
          pm2.disconnect();
          reject(err);
        });
    });
  });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down Trading Engine Manager...');
  await saveState();
  pm2.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down Trading Engine Manager...');
  await saveState();
  pm2.disconnect();
  process.exit(0);
});

// Start if run directly
if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { main, syncProcesses, startTradingEngine, stopTradingEngine };

