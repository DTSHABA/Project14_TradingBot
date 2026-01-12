import { MiddlewareHandler } from 'hono';
import { getEnv } from '../lib/env';

/**
 * Enhanced API key authentication middleware for internal API endpoints
 * Used by trading engines to authenticate with the backend
 * 
 * Features:
 * - API key validation
 * - IP whitelisting (only localhost allowed)
 * - Rate limiting (10 requests/second per IP)
 * - Request logging for audit trail
 */

// Simple in-memory rate limiter (for production, consider Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 1000; // 1 second
const RATE_LIMIT_MAX = 10; // 10 requests per second

function getClientIP(c: any): string {
  // Check X-Forwarded-For header (from proxy)
  const forwarded = c.req.header('X-Forwarded-For');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  // Check X-Real-IP header (from Nginx)
  const realIP = c.req.header('X-Real-IP');
  if (realIP) {
    return realIP;
  }
  
  // Fallback (shouldn't happen in production with Nginx)
  return 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetAt) {
    // New window
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false; // Rate limit exceeded
  }
  
  record.count++;
  return true;
}

function isLocalhost(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === 'localhost' ||
    ip.startsWith('127.') ||
    ip.startsWith('::ffff:127.')
  );
}

export const internalApiAuthMiddleware: MiddlewareHandler = async (c, next) => {
  // Get API key from header or query parameter
  const apiKey = c.req.header('X-API-Key') || c.req.query('api_key');
  const expectedKey = getEnv('TRADING_ENGINE_API_KEY') || 'trading-engine-key';
  
  // Validate API key
  if (!apiKey || apiKey !== expectedKey) {
    console.warn(`[Internal API] Invalid API key attempt from ${getClientIP(c)}`);
    return c.json({ error: 'Invalid or missing API key' }, 401);
  }
  
  // IP whitelisting - only allow localhost
  const clientIP = getClientIP(c);
  if (!isLocalhost(clientIP)) {
    console.warn(`[Internal API] Unauthorized IP attempt: ${clientIP}`);
    return c.json({ error: 'Access denied: Internal API is only accessible from localhost' }, 403);
  }
  
  // Rate limiting
  if (!checkRateLimit(clientIP)) {
    console.warn(`[Internal API] Rate limit exceeded for ${clientIP}`);
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }
  
  // Log request for audit trail
  console.log(`[Internal API] ${c.req.method} ${c.req.path} from ${clientIP}`);
  
  await next();
};


