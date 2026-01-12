import { Hono } from 'hono';
import { getDatabase, testDatabaseConnection } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

const healthRoutes = new Hono();

/**
 * Comprehensive health check endpoint
 * Returns status of all system components
 */
healthRoutes.get('/', async (c) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    components: {} as Record<string, any>,
    system: {} as Record<string, any>,
  };

  // Database health check
  try {
    const dbHealthy = await testDatabaseConnection();
    health.components.database = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      connected: dbHealthy,
    };
    if (!dbHealthy) health.status = 'degraded';
  } catch (error) {
    health.components.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    health.status = 'unhealthy';
  }

  // MT5 API service check
  try {
    const mt5ApiUrl = process.env.MT5_API_URL || 'http://localhost:5001';
    const response = await fetch(`${mt5ApiUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    health.components.mt5Api = {
      status: response.ok ? 'healthy' : 'unhealthy',
      statusCode: response.status,
    };
    if (!response.ok) health.status = 'degraded';
  } catch (error) {
    health.components.mt5Api = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    health.status = 'degraded';
  }

  // Trading engine processes check
  try {
    const { stdout } = await execAsync('pm2 jlist');
    const processes = JSON.parse(stdout);
    const tradingEngines = processes.filter((p: any) =>
      p.name?.startsWith('trading-engine-') && p.name !== 'trading-engine-manager'
    );
    
    const runningEngines = tradingEngines.filter((p: any) => p.pm2_env?.status === 'online');
    const erroredEngines = tradingEngines.filter((p: any) => 
      p.pm2_env?.status === 'errored' || p.pm2_env?.status === 'stopped'
    );

    health.components.tradingEngines = {
      status: erroredEngines.length > 0 ? 'degraded' : 'healthy',
      total: tradingEngines.length,
      running: runningEngines.length,
      errored: erroredEngines.length,
      processes: tradingEngines.map((p: any) => ({
        name: p.name,
        status: p.pm2_env?.status,
        uptime: p.pm2_env?.pm_uptime,
        memory: p.monit?.memory,
      })),
    };

    if (erroredEngines.length > 0) {
      health.status = 'degraded';
    }
  } catch (error) {
    health.components.tradingEngines = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    // Don't mark as unhealthy if PM2 check fails - might be permission issue
  }

  // System resources
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = (usedMem / totalMem) * 100;

    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    health.system = {
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percent: Math.round(memPercent * 100) / 100,
      },
      cpu: {
        cores: cpus.length,
        loadAverage: loadAvg,
      },
      uptime: os.uptime(),
    };

    // Warn if memory usage is high
    if (memPercent > 90) {
      health.status = 'degraded';
      health.system.memory.warning = 'High memory usage';
    }
  } catch (error) {
    health.system = {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Backend service status
  health.components.backend = {
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  // Trading Engine Manager status
  try {
    const { stdout } = await execAsync('pm2 describe trading-engine-manager');
    const managerRunning = stdout.includes('online');
    health.components.tradingEngineManager = {
      status: managerRunning ? 'healthy' : 'unhealthy',
      running: managerRunning,
    };
    if (!managerRunning) health.status = 'degraded';
  } catch (error) {
    health.components.tradingEngineManager = {
      status: 'error',
      error: 'Manager process not found',
    };
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  return c.json(health, statusCode);
});

/**
 * Simple health check (lighter weight)
 */
healthRoutes.get('/simple', async (c) => {
  try {
    const dbHealthy = await testDatabaseConnection();
    return c.json({
      status: dbHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
    }, dbHealthy ? 200 : 503);
  } catch (error) {
    return c.json({
      status: 'error',
      timestamp: new Date().toISOString(),
    }, 503);
  }
});

export default healthRoutes;


