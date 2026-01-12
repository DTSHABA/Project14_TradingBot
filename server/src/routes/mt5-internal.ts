import { Hono } from 'hono';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import { decrypt } from '../lib/encryption';
import { mt5Accounts } from '../schema/mt5_accounts';
import { eq, and } from 'drizzle-orm';

const mt5InternalRoutes = new Hono();

/**
 * Get MT5 account credentials for trading engine
 * Requires API key authentication (handled by middleware)
 * Used by trading engine to fetch credentials for a specific user/account
 */
mt5InternalRoutes.get('/accounts/:user_id/:mt5_account_id/credentials', async (c) => {
  try {
    const userId = c.req.param('user_id');
    const mt5AccountId = c.req.param('mt5_account_id');
    
    if (!userId || !mt5AccountId) {
      return c.json({ error: 'user_id and mt5_account_id are required' }, 400);
    }
    
    const db = await getDatabase(getDatabaseUrl());
    
    // Get account with encrypted credentials
    const [account] = await db.select()
      .from(mt5Accounts)
      .where(and(
        eq(mt5Accounts.id, mt5AccountId),
        eq(mt5Accounts.user_id, userId)
      ))
      .limit(1);
    
    if (!account) {
      return c.json({ error: 'MT5 account not found' }, 404);
    }
    
    // Decrypt credentials
    let accountNumber: string;
    let password: string;
    try {
      accountNumber = decrypt(account.account_number);
      password = decrypt(account.password);
    } catch (error) {
      console.error('Error decrypting credentials:', error);
      return c.json({ error: 'Failed to decrypt credentials' }, 500);
    }
    
    // Return credentials (only to authenticated trading engine)
    return c.json({
      user_id: userId,
      mt5_account_id: mt5AccountId,
      account_number: accountNumber,
      password: password,
      server: account.server,
      broker_name: account.broker_name,
      is_active: account.is_active,
    });
  } catch (error) {
    console.error('Error fetching MT5 credentials:', error);
    return c.json({ error: 'Failed to fetch MT5 credentials' }, 500);
  }
});

/**
 * Get active MT5 account credentials for a user
 * Returns the active account's credentials
 */
mt5InternalRoutes.get('/accounts/:user_id/active/credentials', async (c) => {
  try {
    const userId = c.req.param('user_id');
    
    if (!userId) {
      return c.json({ error: 'user_id is required' }, 400);
    }
    
    const db = await getDatabase(getDatabaseUrl());
    
    // Get active account
    const [account] = await db.select()
      .from(mt5Accounts)
      .where(and(
        eq(mt5Accounts.user_id, userId),
        eq(mt5Accounts.is_active, true)
      ))
      .limit(1);
    
    if (!account) {
      return c.json({ error: 'No active MT5 account found for user' }, 404);
    }
    
    // Decrypt credentials
    let accountNumber: string;
    let password: string;
    try {
      accountNumber = decrypt(account.account_number);
      password = decrypt(account.password);
    } catch (error) {
      console.error('Error decrypting credentials:', error);
      return c.json({ error: 'Failed to decrypt credentials' }, 500);
    }
    
    return c.json({
      user_id: userId,
      mt5_account_id: account.id,
      account_number: accountNumber,
      password: password,
      server: account.server,
      broker_name: account.broker_name,
      is_active: account.is_active,
    });
  } catch (error) {
    console.error('Error fetching active MT5 credentials:', error);
    return c.json({ error: 'Failed to fetch active MT5 credentials' }, 500);
  }
});

export default mt5InternalRoutes;

