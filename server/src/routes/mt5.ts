import { Hono } from 'hono';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import { encrypt, decrypt } from '../lib/encryption';
import { testMT5Connection, validateMT5Credentials } from '../lib/mt5-connector';
import { mt5Accounts } from '../schema/mt5_accounts';
import { eq, and } from 'drizzle-orm';

const mt5Routes = new Hono();

// Create new MT5 account connection
mt5Routes.post('/accounts', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { account_number, password, server, broker_name } = body;

    // Validate input
    if (!account_number || !password || !server) {
      return c.json({ error: 'account_number, password, and server are required' }, 400);
    }

    // Validate credentials format
    const validation = validateMT5Credentials(account_number, password, server);
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    // Encrypt credentials
    const encryptedAccountNumber = encrypt(account_number);
    const encryptedPassword = encrypt(password);

    const db = await getDatabase(getDatabaseUrl());

    // Insert new account
    const [newAccount] = await db.insert(mt5Accounts)
      .values({
        user_id: user.id,
        account_number: encryptedAccountNumber,
        password: encryptedPassword,
        server: server.trim(),
        broker_name: broker_name?.trim() || null,
        is_active: false,
        connection_status: 'disconnected',
      })
      .returning();

    // Return account without encrypted fields
    return c.json({
      id: newAccount.id,
      server: newAccount.server,
      broker_name: newAccount.broker_name,
      is_active: newAccount.is_active,
      connection_status: newAccount.connection_status,
      last_connection_test: newAccount.last_connection_test,
      created_at: newAccount.created_at,
      updated_at: newAccount.updated_at,
    }, 201);
  } catch (error) {
    console.error('Error creating MT5 account:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      // Check for encryption key errors
      if (error.message.includes('ENCRYPTION_KEY')) {
        return c.json({ 
          error: 'Server configuration error: Encryption key is missing or invalid. Please contact support.' 
        }, 500);
      }
      
      // Check for database errors
      if (error.message.includes('database') || error.message.includes('connection')) {
        return c.json({ 
          error: 'Database connection error. Please try again later.' 
        }, 500);
      }
      
      // Check for validation errors
      if (error.message.includes('violates') || error.message.includes('constraint')) {
        return c.json({ 
          error: 'Invalid account data. Please check your input and try again.' 
        }, 400);
      }
      
      // Return the actual error message for debugging (in development)
      const errorMessage = process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'Failed to create MT5 account';
      
      return c.json({ error: errorMessage }, 500);
    }
    
    return c.json({ error: 'Failed to create MT5 account' }, 500);
  }
});

// List all user's MT5 accounts
mt5Routes.get('/accounts', async (c) => {
  try {
    const user = c.get('user');
    const db = await getDatabase(getDatabaseUrl());

    const accounts = await db.select({
      id: mt5Accounts.id,
      server: mt5Accounts.server,
      broker_name: mt5Accounts.broker_name,
      is_active: mt5Accounts.is_active,
      connection_status: mt5Accounts.connection_status,
      last_connection_test: mt5Accounts.last_connection_test,
      created_at: mt5Accounts.created_at,
      updated_at: mt5Accounts.updated_at,
    })
      .from(mt5Accounts)
      .where(eq(mt5Accounts.user_id, user.id));

    return c.json(accounts);
  } catch (error) {
    console.error('Error fetching MT5 accounts:', error);
    return c.json({ error: 'Failed to fetch MT5 accounts' }, 500);
  }
});

// Get specific account details
mt5Routes.get('/accounts/:id', async (c) => {
  try {
    const user = c.get('user');
    const accountId = c.req.param('id');
    const db = await getDatabase(getDatabaseUrl());

    const [account] = await db.select({
      id: mt5Accounts.id,
      server: mt5Accounts.server,
      broker_name: mt5Accounts.broker_name,
      is_active: mt5Accounts.is_active,
      connection_status: mt5Accounts.connection_status,
      last_connection_test: mt5Accounts.last_connection_test,
      created_at: mt5Accounts.created_at,
      updated_at: mt5Accounts.updated_at,
    })
      .from(mt5Accounts)
      .where(and(
        eq(mt5Accounts.id, accountId),
        eq(mt5Accounts.user_id, user.id)
      ))
      .limit(1);

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    return c.json(account);
  } catch (error) {
    console.error('Error fetching MT5 account:', error);
    return c.json({ error: 'Failed to fetch MT5 account' }, 500);
  }
});

// Test MT5 connection
mt5Routes.post('/accounts/:id/test', async (c) => {
  try {
    const user = c.get('user');
    const accountId = c.req.param('id');
    const db = await getDatabase(getDatabaseUrl());

    // Get account with encrypted credentials
    const [account] = await db.select()
      .from(mt5Accounts)
      .where(and(
        eq(mt5Accounts.id, accountId),
        eq(mt5Accounts.user_id, user.id)
      ))
      .limit(1);

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
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

    // Test connection
    const connectionResult = await testMT5Connection(
      accountNumber,
      password,
      account.server
    );

    // Update account status
    await db.update(mt5Accounts)
      .set({
        connection_status: connectionResult.connected ? 'connected' : 'error',
        last_connection_test: new Date(),
        updated_at: new Date(),
      })
      .where(eq(mt5Accounts.id, accountId));

    if (connectionResult.connected) {
      return c.json({
        connected: true,
        account_info: connectionResult.account_info,
      });
    } else {
      return c.json({
        connected: false,
        error: connectionResult.error || 'Connection failed',
      });
    }
  } catch (error) {
    console.error('Error testing MT5 connection:', error);
    return c.json({ error: 'Failed to test MT5 connection' }, 500);
  }
});

// Update account (server, broker_name only)
mt5Routes.put('/accounts/:id', async (c) => {
  try {
    const user = c.get('user');
    const accountId = c.req.param('id');
    const body = await c.req.json();
    const { server, broker_name } = body;

    const db = await getDatabase(getDatabaseUrl());

    // Verify account belongs to user
    const [account] = await db.select()
      .from(mt5Accounts)
      .where(and(
        eq(mt5Accounts.id, accountId),
        eq(mt5Accounts.user_id, user.id)
      ))
      .limit(1);

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    // Update only allowed fields
    const updateData: { server?: string; broker_name?: string | null; updated_at: Date } = {
      updated_at: new Date(),
    };

    if (server !== undefined) {
      updateData.server = server.trim();
    }

    if (broker_name !== undefined) {
      updateData.broker_name = broker_name?.trim() || null;
    }

    const [updatedAccount] = await db.update(mt5Accounts)
      .set(updateData)
      .where(eq(mt5Accounts.id, accountId))
      .returning({
        id: mt5Accounts.id,
        server: mt5Accounts.server,
        broker_name: mt5Accounts.broker_name,
        is_active: mt5Accounts.is_active,
        connection_status: mt5Accounts.connection_status,
        last_connection_test: mt5Accounts.last_connection_test,
        created_at: mt5Accounts.created_at,
        updated_at: mt5Accounts.updated_at,
      });

    return c.json(updatedAccount);
  } catch (error) {
    console.error('Error updating MT5 account:', error);
    return c.json({ error: 'Failed to update MT5 account' }, 500);
  }
});

// Delete account
mt5Routes.delete('/accounts/:id', async (c) => {
  try {
    const user = c.get('user');
    const accountId = c.req.param('id');
    const db = await getDatabase(getDatabaseUrl());

    // Verify account belongs to user
    const [account] = await db.select()
      .from(mt5Accounts)
      .where(and(
        eq(mt5Accounts.id, accountId),
        eq(mt5Accounts.user_id, user.id)
      ))
      .limit(1);

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    // Delete account (cascade will handle related records)
    await db.delete(mt5Accounts)
      .where(eq(mt5Accounts.id, accountId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting MT5 account:', error);
    return c.json({ error: 'Failed to delete MT5 account' }, 500);
  }
});

// Activate account (deactivates others)
mt5Routes.post('/accounts/:id/activate', async (c) => {
  try {
    const user = c.get('user');
    const accountId = c.req.param('id');
    const db = await getDatabase(getDatabaseUrl());

    // Verify account belongs to user
    const [account] = await db.select()
      .from(mt5Accounts)
      .where(and(
        eq(mt5Accounts.id, accountId),
        eq(mt5Accounts.user_id, user.id)
      ))
      .limit(1);

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    // Deactivate all user's accounts
    await db.update(mt5Accounts)
      .set({
        is_active: false,
        updated_at: new Date(),
      })
      .where(eq(mt5Accounts.user_id, user.id));

    // Activate the specified account
    await db.update(mt5Accounts)
      .set({
        is_active: true,
        updated_at: new Date(),
      })
      .where(eq(mt5Accounts.id, accountId));

    return c.json({ success: true, is_active: true });
  } catch (error) {
    console.error('Error activating MT5 account:', error);
    return c.json({ error: 'Failed to activate MT5 account' }, 500);
  }
});

// Get live account info for active account
mt5Routes.get('/live-account-info', async (c) => {
  try {
    const user = c.get('user');
    const db = await getDatabase(getDatabaseUrl());

    // Get active MT5 account
    const [activeAccount] = await db.select()
      .from(mt5Accounts)
      .where(and(
        eq(mt5Accounts.user_id, user.id),
        eq(mt5Accounts.is_active, true)
      ))
      .limit(1);

    if (!activeAccount) {
      return c.json({ error: 'No active MT5 account found' }, 404);
    }

    // Decrypt credentials
    let accountNumber: string;
    let password: string;
    try {
      accountNumber = decrypt(activeAccount.account_number);
      password = decrypt(activeAccount.password);
    } catch (error) {
      console.error('Error decrypting credentials:', error);
      return c.json({ error: 'Failed to decrypt credentials' }, 500);
    }

    // Test connection to get live account info
    const connectionResult = await testMT5Connection(
      accountNumber,
      password,
      activeAccount.server
    );

    if (!connectionResult.connected || !connectionResult.account_info) {
      return c.json({
        error: connectionResult.error || 'Failed to connect to MT5',
        connected: false,
      }, 503);
    }

    return c.json({
      connected: true,
      account_id: activeAccount.id,
      server: activeAccount.server,
      broker_name: activeAccount.broker_name,
      equity: connectionResult.account_info.equity,
      balance: connectionResult.account_info.balance,
      margin: connectionResult.account_info.margin,
      margin_free: connectionResult.account_info.margin_free,
      margin_level: connectionResult.account_info.margin_level,
      currency: connectionResult.account_info.currency,
      last_updated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching live MT5 account info:', error);
    return c.json({ error: 'Failed to fetch live account info' }, 500);
  }
});

export default mt5Routes;

