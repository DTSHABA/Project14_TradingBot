import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth';
import { getDatabase, testDatabaseConnection } from './lib/db';
import { setEnvContext, clearEnvContext, getDatabaseUrl } from './lib/env';
import * as schema from './schema/users';

type Env = {
  RUNTIME?: string;
  [key: string]: any;
};

const app = new Hono<{ Bindings: Env }>();

// In Node.js environment, set environment context from process.env
if (typeof process !== 'undefined' && process.env) {
  setEnvContext(process.env);
}

// Environment context middleware - detect runtime using RUNTIME env var
app.use('*', async (c, next) => {
  if (c.env?.RUNTIME === 'cloudflare') {
    setEnvContext(c.env);
  }
  
  await next();
  // No need to clear context - env vars are the same for all requests
  // In fact, clearing the context would cause the env vars to potentially be unset for parallel requests
});

// Middleware
app.use('*', logger());
app.use('*', cors());

// Health check route - public
app.get('/', (c) => c.json({ status: 'ok', message: 'API is running' }));

// API routes
const api = new Hono();

// Public routes go here (if any)
api.get('/hello', (c) => {
  return c.json({
    message: 'Hello from Hono!',
  });
});

// Internal API routes for trading engine (API key auth)
const internalApi = new Hono();

// Enhanced API key middleware with IP whitelisting and rate limiting
import { internalApiAuthMiddleware } from './middleware/internal-api-auth';
internalApi.use('*', internalApiAuthMiddleware);

// Import trading activity routes for internal access
import tradingActivityRoutes from './routes/trading-activity';
import mt5InternalRoutes from './routes/mt5-internal';
internalApi.route('/trading-activity', tradingActivityRoutes);
internalApi.route('/mt5', mt5InternalRoutes);

api.route('/internal', internalApi);

// Database test route - public for testing
api.get('/db-test', async (c) => {
  try {
    // Use external DB URL if available, otherwise use local PostgreSQL database server
    // Note: In development, the port is dynamically allocated by port-manager.js
    const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
    const dbUrl = getDatabaseUrl() || defaultLocalConnection;
    
    const db = await getDatabase(dbUrl);
    const isHealthy = await testDatabaseConnection();
    
    if (!isHealthy) {
      return c.json({
        error: 'Database connection is not healthy',
        timestamp: new Date().toISOString(),
      }, 500);
    }
    
    const result = await db.select().from(schema.users).limit(5);
    
    return c.json({
      message: 'Database connection successful!',
      users: result,
      connectionHealthy: isHealthy,
      usingLocalDatabase: !getDatabaseUrl(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database test error:', error);
    return c.json({
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// Protected routes - require authentication
const protectedRoutes = new Hono();

protectedRoutes.use('*', authMiddleware);

protectedRoutes.get('/me', (c) => {
  const user = c.get('user');
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      photo_url: user.photo_url,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
    message: 'You are authenticated!',
  });
});

// Import route modules
import mt5Routes from './routes/mt5';
import botConfigRoutes from './routes/bot-config';
import tradingActivityRoutes from './routes/trading-activity';
import dashboardRoutes from './routes/dashboard';
import analyticsRoutes from './routes/analytics';
import accountSettingsRoutes from './routes/account-settings';
import healthRoutes from './routes/health';

// Mount feature routes under protected BEFORE mounting protectedRoutes to api
// This ensures all child routes are included when protectedRoutes is mounted
protectedRoutes.route('/mt5', mt5Routes);
protectedRoutes.route('/bot-config', botConfigRoutes);
protectedRoutes.route('/trading', tradingActivityRoutes);
protectedRoutes.route('/dashboard', dashboardRoutes);
protectedRoutes.route('/analytics', analyticsRoutes);
protectedRoutes.route('/account-settings', accountSettingsRoutes);

// Mount the protected routes under /protected (after child routes are added)
api.route('/protected', protectedRoutes);

// Health check routes (public)
api.route('/health', healthRoutes);

// Mount the API router
app.route('/api/v1', api);

export default app; 