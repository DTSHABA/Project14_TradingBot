#!/usr/bin/env node
/**
 * Trading Engine Health Monitor
 * Monitors health of all trading engine processes and system components
 */

const pm2 = require('pm2');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

const MONITOR_INTERVAL = 30000; // 30 seconds
const ALERT_THRESHOLD = 3; // Alert after 3 consecutive failures
const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL || 'http://localhost:5500/api/v1/health';

let failureCounts = new Map();
let lastHealthCheck = null;

/**
 * Check PM2 process status
 */
async function checkPM2Processes() {
  return new Promise((resolve, reject) => {
    pm2.list((err, processes) => {
      if (err) return reject(err);
      
      const tradingEngines = processes.filter((p) =>
        p.name?.startsWith('trading-engine-') && p.name !== 'trading-engine-manager'
      );
      
      const manager = processes.find((p) => p.name === 'trading-engine-manager');
      const backend = processes.find((p) => p.name === 'backend');
      const mt5Api = processes.find((p) => p.name === 'mt5-api');
      
      resolve({
        tradingEngines,
        manager,
        backend,
        mt5Api,
        all: processes,
      });
    });
  });
}

/**
 * Check system health via API
 */
async function checkSystemHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(HEALTH_CHECK_URL, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Health check API error:', error.message);
    return null;
  }
}

/**
 * Monitor trading engine processes
 */
async function monitorTradingEngines(processes) {
  const issues = [];
  
  for (const process of processes.tradingEngines) {
    const status = process.pm2_env?.status;
    const name = process.name;
    
    if (status !== 'online') {
      issues.push({
        type: 'process_status',
        process: name,
        status: status,
        message: `Trading engine ${name} is ${status}`,
      });
      
      // Increment failure count
      const count = (failureCounts.get(name) || 0) + 1;
      failureCounts.set(name, count);
      
      if (count >= ALERT_THRESHOLD) {
        console.error(`ALERT: ${name} has been ${status} for ${count} consecutive checks`);
      }
    } else {
      // Reset failure count on success
      failureCounts.delete(name);
    }
  }
  
  return issues;
}

/**
 * Check manager process
 */
async function checkManager(manager) {
  if (!manager) {
    return {
      type: 'manager_missing',
      message: 'Trading engine manager process not found',
    };
  }
  
  if (manager.pm2_env?.status !== 'online') {
    return {
      type: 'manager_status',
      status: manager.pm2_env?.status,
      message: `Trading engine manager is ${manager.pm2_env?.status}`,
    };
  }
  
  return null;
}

/**
 * Check backend and MT5 API
 */
async function checkServices(backend, mt5Api) {
  const issues = [];
  
  if (!backend || backend.pm2_env?.status !== 'online') {
    issues.push({
      type: 'backend_status',
      status: backend?.pm2_env?.status || 'missing',
      message: 'Backend API is not running',
    });
  }
  
  if (!mt5Api || mt5Api.pm2_env?.status !== 'online') {
    issues.push({
      type: 'mt5_api_status',
      status: mt5Api?.pm2_env?.status || 'missing',
      message: 'MT5 API service is not running',
    });
  }
  
  return issues;
}

/**
 * Generate status report
 */
function generateStatusReport(processes, healthData, issues) {
  const report = {
    timestamp: new Date().toISOString(),
    status: issues.length === 0 ? 'healthy' : 'degraded',
    processes: {
      tradingEngines: {
        total: processes.tradingEngines.length,
        running: processes.tradingEngines.filter((p) => p.pm2_env?.status === 'online').length,
        stopped: processes.tradingEngines.filter((p) => p.pm2_env?.status === 'stopped').length,
        errored: processes.tradingEngines.filter((p) => p.pm2_env?.status === 'errored').length,
      },
      manager: {
        status: processes.manager?.pm2_env?.status || 'missing',
        uptime: processes.manager?.pm2_env?.pm_uptime || 0,
      },
      backend: {
        status: processes.backend?.pm2_env?.status || 'missing',
        uptime: processes.backend?.pm2_env?.pm_uptime || 0,
      },
      mt5Api: {
        status: processes.mt5Api?.pm2_env?.status || 'missing',
        uptime: processes.mt5Api?.pm2_env?.pm_uptime || 0,
      },
    },
    health: healthData,
    issues: issues,
  };
  
  return report;
}

/**
 * Save status report to file
 */
async function saveStatusReport(report) {
  try {
    const reportDir = path.join(__dirname, '..', 'deployment', 'reports');
    await fs.mkdir(reportDir, { recursive: true });
    
    const reportFile = path.join(reportDir, `status-${Date.now()}.json`);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
    
    // Keep only last 10 reports
    const files = await fs.readdir(reportDir);
    const reportFiles = files.filter((f) => f.startsWith('status-')).sort().reverse();
    if (reportFiles.length > 10) {
      for (const file of reportFiles.slice(10)) {
        await fs.unlink(path.join(reportDir, file));
      }
    }
  } catch (error) {
    console.error('Error saving status report:', error);
  }
}

/**
 * Main monitoring loop
 */
async function monitor() {
  try {
    const processes = await checkPM2Processes();
    const healthData = await checkSystemHealth();
    
    const issues = [];
    
    // Check trading engines
    const engineIssues = await monitorTradingEngines(processes);
    issues.push(...engineIssues);
    
    // Check manager
    const managerIssue = await checkManager(processes.manager);
    if (managerIssue) {
      issues.push(managerIssue);
    }
    
    // Check services
    const serviceIssues = await checkServices(processes.backend, processes.mt5Api);
    issues.push(...serviceIssues);
    
    // Generate report
    const report = generateStatusReport(processes, healthData, issues);
    
    // Log status
    if (issues.length === 0) {
      console.log(`[${new Date().toISOString()}] Status: HEALTHY - ${report.processes.tradingEngines.running} trading engines running`);
    } else {
      console.warn(`[${new Date().toISOString()}] Status: DEGRADED - ${issues.length} issue(s) found`);
      issues.forEach((issue) => {
        console.warn(`  - ${issue.message}`);
      });
    }
    
    // Save report
    await saveStatusReport(report);
    
    lastHealthCheck = report;
  } catch (error) {
    console.error('Monitor error:', error);
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('Starting Trading Engine Health Monitor...');
  console.log(`Monitor interval: ${MONITOR_INTERVAL / 1000}s`);
  console.log(`Health check URL: ${HEALTH_CHECK_URL}`);
  
  // Connect to PM2
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        console.error('Error connecting to PM2:', err);
        return reject(err);
      }
      
      console.log('Connected to PM2');
      
      // Initial check
      monitor();
      
      // Periodic monitoring
      setInterval(monitor, MONITOR_INTERVAL);
      
      console.log('Trading Engine Health Monitor running');
    });
  });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down monitor...');
  pm2.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down monitor...');
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

module.exports = { main, monitor };

