import { Hono } from 'hono';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import { trades, tradingSignals, circuitBreakerEvents } from '../schema/trading_activity';
import { mt5Accounts } from '../schema/mt5_accounts';
import { botConfigs } from '../schema/bot_configs';
import { eq, and, desc, gte, sql, isNotNull, or } from 'drizzle-orm';
import { testMT5Connection } from '../lib/mt5-connector';
import { decrypt } from '../lib/encryption';

const dashboardRoutes = new Hono();

// Get real-time dashboard status
dashboardRoutes.get('/status', async (c) => {
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
      return c.json({
        error: 'No active MT5 account found',
        bot_status: 'inactive',
      });
    }

    // Get bot config
    const [config] = await db.select()
      .from(botConfigs)
      .where(and(
        eq(botConfigs.mt5_account_id, activeAccount.id),
        eq(botConfigs.user_id, user.id)
      ))
      .limit(1);

    // Get today's trades
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTrades = await db.select()
      .from(trades)
      .where(and(
        eq(trades.user_id, user.id),
        eq(trades.mt5_account_id, activeAccount.id),
        gte(trades.entry_time, today),
        isNotNull(trades.exit_time)
      ));

    // Calculate daily P&L
    const dailyPnl = todayTrades.reduce((sum, trade) => {
      return sum + (trade.pnl ? parseFloat(trade.pnl) : 0);
    }, 0);

    // Get open position
    const [openPosition] = await db.select()
      .from(trades)
      .where(and(
        eq(trades.user_id, user.id),
        eq(trades.mt5_account_id, activeAccount.id),
        sql`${trades.exit_time} IS NULL`
      ))
      .limit(1);

    // Calculate today's stats
    const wins = todayTrades.filter((t) => t.pnl && parseFloat(t.pnl) > 0).length;
    const winRate = todayTrades.length > 0 ? (wins / todayTrades.length) * 100 : 0;
    const avgHoldTime = todayTrades.length > 0
      ? todayTrades.reduce((sum, t) => sum + (t.hold_time_seconds || 0), 0) / todayTrades.length
      : 0;

    // Determine bot status
    let botStatus = 'inactive';
    if (activeAccount.connection_status === 'connected' && config?.is_trading_active) {
      botStatus = 'active';
    } else if (activeAccount.connection_status === 'connected' && !config?.is_trading_active) {
      botStatus = 'paused';
    } else if (activeAccount.connection_status === 'error') {
      botStatus = 'error';
    }

    // Fetch real equity from MT5 - NO FALLBACK VALUES
    // Only show equity if we can actually get it from MT5
    let equity: number | null = null;
    let startingBalance: number | null = null;
    let equityError: string | null = null;
    
    try {
      // Decrypt credentials for the active account
      let accountNumber: string | null = null;
      let password: string | null = null;
      try {
        accountNumber = decrypt(activeAccount.account_number);
        password = decrypt(activeAccount.password);
      } catch (decryptError) {
        console.error('[Dashboard] Error decrypting credentials:', decryptError);
        equityError = 'Failed to decrypt account credentials';
      }

      // Only test connection if decryption succeeded
      if (accountNumber && password) {
        // Test connection to the specific active account (same as onboarding)
        const connectionResult = await testMT5Connection(
          accountNumber,
          password,
          activeAccount.server
        );
        
        if (connectionResult.connected && connectionResult.account_info) {
          // Use real equity from MT5 for the active account
          equity = connectionResult.account_info.equity;
          startingBalance = connectionResult.account_info.balance;
          
          console.log(`[Dashboard] Active account: ${activeAccount.id}, Server: ${activeAccount.server}, Using MT5 equity: ${equity}, balance: ${startingBalance}`);
        } else {
          // MT5 connection failed - don't show dummy data
          equityError = connectionResult.error || 'Failed to connect to MT5';
          console.warn(`[Dashboard] MT5 connection test failed for account ${activeAccount.id} (${activeAccount.server}). Error: ${equityError}`);
        }
      }
    } catch (error) {
      // If MT5 API call fails, don't show dummy data
      equityError = error instanceof Error ? error.message : 'Unknown error connecting to MT5';
      console.error('[Dashboard] Error testing MT5 connection:', error);
    }

    // Calculate daily P&L percent only if we have real balance
    const dailyPnlPercent = startingBalance && startingBalance > 0 ? (dailyPnl / startingBalance) * 100 : null;

    return c.json({
      equity: equity !== null ? equity : undefined, // Only include if we have real equity
      equity_error: equityError || undefined, // Include error if we couldn't get equity
      daily_pnl: {
        amount: dailyPnl,
        percent: dailyPnlPercent !== null ? dailyPnlPercent : undefined,
      },
      open_position: openPosition || null,
      bot_status: botStatus,
      today_stats: {
        trades: todayTrades.length,
        win_rate: winRate,
        avg_hold_time: avgHoldTime,
      },
      connection_status: activeAccount.connection_status,
    });
  } catch (error) {
    console.error('Error fetching dashboard status:', error);
    return c.json({ error: 'Failed to fetch dashboard status' }, 500);
  }
});

// Get live activity feed
dashboardRoutes.get('/activity-feed', async (c) => {
  try {
    const user = c.get('user');
    const limit = parseInt(c.req.query('limit') || '50');
    const since = c.req.query('since'); // ISO timestamp for incremental updates

    const db = await getDatabase(getDatabaseUrl());

    // Get active account
    const [activeAccount] = await db.select()
      .from(mt5Accounts)
      .where(and(
        eq(mt5Accounts.user_id, user.id),
        eq(mt5Accounts.is_active, true)
      ))
      .limit(1);

    if (!activeAccount) {
      return c.json({ events: [], last_timestamp: null });
    }

    // Fetch signals
    let signalsWhere = and(
      eq(tradingSignals.user_id, user.id),
      eq(tradingSignals.mt5_account_id, activeAccount.id)
    );

    if (since) {
      signalsWhere = and(
        signalsWhere,
        gte(tradingSignals.timestamp, new Date(since))
      );
    }

    const signalsData = await db.select()
      .from(tradingSignals)
      .where(signalsWhere)
      .orderBy(desc(tradingSignals.timestamp))
      .limit(limit);

    const signals = signalsData.map((s) => {
      let message = `${s.signal_type} signal (${s.confidence}% confidence) at $${s.price}`;
      if (s.rejection_reason) {
        message += ` - REJECTED: ${s.rejection_reason}`;
      } else if (s.became_trade) {
        message += ` - EXECUTED`;
      }
      if (s.reason) {
        message += ` | ${s.reason}`;
      }
      return {
        id: s.id,
        type: 'signal',
        event_type: s.rejection_reason ? 'signal_rejected' : s.became_trade ? 'signal_executed' : s.signal_type.toLowerCase(),
        message,
        timestamp: s.timestamp.toISOString(),
      };
    });

    // Fetch trades
    const tradesConditions = [
      eq(trades.user_id, user.id),
      eq(trades.mt5_account_id, activeAccount.id)
    ];

    if (since) {
      const sinceDate = new Date(since);
      const orCondition = or(
        gte(trades.entry_time, sinceDate),
        and(
          isNotNull(trades.exit_time),
          gte(trades.exit_time, sinceDate)
        )
      );
      if (orCondition) {
        tradesConditions.push(orCondition);
      }
    }

    const tradesWhere = tradesConditions.length === 1 
      ? tradesConditions[0] 
      : and(...tradesConditions);

    const tradesData = await db.select()
      .from(trades)
      .where(tradesWhere)
      .orderBy(desc(trades.entry_time))
      .limit(limit);

    const tradeEvents = tradesData.map((t) => ({
      id: t.id,
      type: 'trade',
      event_type: t.exit_time ? 'trade_closed' : 'trade_opened',
      message: `Trade ${t.exit_time ? 'closed' : 'opened'}: ${t.direction} ${t.lot_size} lots at $${t.entry_price}`,
      timestamp: (t.exit_time || t.entry_time).toISOString(),
    }));

    // Fetch circuit breaker events
    let cbWhere = and(
      eq(circuitBreakerEvents.user_id, user.id),
      eq(circuitBreakerEvents.mt5_account_id, activeAccount.id)
    );

    if (since) {
      cbWhere = and(
        cbWhere,
        gte(circuitBreakerEvents.timestamp, new Date(since))
      );
    }

    const cbData = await db.select()
      .from(circuitBreakerEvents)
      .where(cbWhere)
      .orderBy(desc(circuitBreakerEvents.timestamp))
      .limit(20);

    const cbEvents = cbData.map((c) => ({
      id: c.id,
      type: 'circuit_breaker',
      event_type: c.event_type,
      message: `Circuit breaker ${c.event_type}: ${c.reason || ''}`,
      timestamp: c.timestamp.toISOString(),
    }));

    // Merge and sort all events (all timestamps are now ISO strings)
    const allEvents = [
      ...signals,
      ...tradeEvents,
      ...cbEvents,
    ].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    }).slice(0, limit);

    const lastTimestamp = allEvents.length > 0 ? allEvents[0].timestamp : null;

    return c.json({
      events: allEvents,
      last_timestamp: lastTimestamp,
    });
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    return c.json({ error: 'Failed to fetch activity feed' }, 500);
  }
});

// Force close open position
dashboardRoutes.post('/force-close-position', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { mt5_account_id } = body;

    if (!mt5_account_id) {
      return c.json({ error: 'mt5_account_id is required' }, 400);
    }

    const db = await getDatabase(getDatabaseUrl());

    // Verify account belongs to user
    const [account] = await db.select()
      .from(mt5Accounts)
      .where(and(
        eq(mt5Accounts.id, mt5_account_id),
        eq(mt5Accounts.user_id, user.id)
      ))
      .limit(1);

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    // Get open position
    const [openPosition] = await db.select()
      .from(trades)
      .where(and(
        eq(trades.user_id, user.id),
        eq(trades.mt5_account_id, mt5_account_id),
        sql`${trades.exit_time} IS NULL`
      ))
      .limit(1);

    if (!openPosition) {
      return c.json({ error: 'No open position found' }, 404);
    }

    // TODO: Actually close the position via MT5 API
    // For now, just mark it as force closed in the database
    await db.update(trades)
      .set({
        exit_reason: 'force_close',
        exit_time: new Date(),
        updated_at: new Date(),
      })
      .where(eq(trades.id, openPosition.id));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error force closing position:', error);
    return c.json({ error: 'Failed to force close position' }, 500);
  }
});

// Reset circuit breaker
dashboardRoutes.post('/reset-circuit-breaker', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { mt5_account_id } = body;

    if (!mt5_account_id) {
      return c.json({ error: 'mt5_account_id is required' }, 400);
    }

    const db = await getDatabase(getDatabaseUrl());

    // Verify account belongs to user
    const [account] = await db.select()
      .from(mt5Accounts)
      .where(and(
        eq(mt5Accounts.id, mt5_account_id),
        eq(mt5Accounts.user_id, user.id)
      ))
      .limit(1);

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    // Create reset event
    await db.insert(circuitBreakerEvents)
      .values({
        user_id: user.id,
        mt5_account_id,
        event_type: 'reset',
        reason: 'Manual reset by user',
      });

    // TODO: Actually reset circuit breaker in trading engine
    // This would require communication with the trading engine service

    return c.json({ success: true });
  } catch (error) {
    console.error('Error resetting circuit breaker:', error);
    return c.json({ error: 'Failed to reset circuit breaker' }, 500);
  }
});

export default dashboardRoutes;

