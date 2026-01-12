import { Hono } from 'hono';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import { tradingSignals, trades, circuitBreakerEvents } from '../schema/trading_activity';
import { mt5Accounts } from '../schema/mt5_accounts';
import { eq, and, desc, gte, lte, sql, isNotNull, or } from 'drizzle-orm';

const tradingActivityRoutes = new Hono();

// Get recent signals
tradingActivityRoutes.get('/signals', async (c) => {
  try {
    const user = c.get('user');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const mt5AccountId = c.req.query('mt5_account_id');
    const signalType = c.req.query('signal_type');
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');

    const db = await getDatabase(getDatabaseUrl());

    // Build conditions incrementally
    const conditions = [eq(tradingSignals.user_id, user.id)];

    if (mt5AccountId) {
      conditions.push(eq(tradingSignals.mt5_account_id, mt5AccountId));
    }

    if (signalType) {
      conditions.push(eq(tradingSignals.signal_type, signalType as 'BUY' | 'SELL' | 'HOLD'));
    }

    if (dateFrom) {
      conditions.push(gte(tradingSignals.timestamp, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(tradingSignals.timestamp, new Date(dateTo)));
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const results = await db.select()
      .from(tradingSignals)
      .where(whereClause)
      .orderBy(desc(tradingSignals.timestamp))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination with same conditions
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tradingSignals)
      .where(whereClause);

    return c.json({
      signals: results,
      pagination: {
        limit,
        offset,
        total: Number(countResult.count),
      },
    });
  } catch (error) {
    console.error('Error fetching signals:', error);
    return c.json({ error: 'Failed to fetch signals' }, 500);
  }
});

// Debug endpoint to check trade counts (temporary)
tradingActivityRoutes.get('/trades/debug', async (c) => {
  try {
    const user = c.get('user');
    const db = await getDatabase(getDatabaseUrl());

    // Get all trades for user
    const allUserTrades = await db.select()
      .from(trades)
      .where(eq(trades.user_id, user.id));

    // Get trades by MT5 account
    const tradesByAccount = await db.select({
      mt5_account_id: trades.mt5_account_id,
      count: sql<number>`count(*)`,
    })
      .from(trades)
      .where(eq(trades.user_id, user.id))
      .groupBy(trades.mt5_account_id);

    // Get date range
    const [dateRange] = await db.select({
      min_date: sql<string>`min(${trades.entry_time})`,
      max_date: sql<string>`max(${trades.entry_time})`,
    })
      .from(trades)
      .where(eq(trades.user_id, user.id));

    return c.json({
      user_id: user.id,
      total_trades: allUserTrades.length,
      trades_by_account: tradesByAccount,
      date_range: dateRange,
      sample_trades: allUserTrades.slice(0, 5).map(t => ({
        id: t.id,
        ticket: t.ticket,
        direction: t.direction,
        entry_time: t.entry_time,
        exit_time: t.exit_time,
        mt5_account_id: t.mt5_account_id,
      })),
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return c.json({ error: 'Failed to fetch debug info' }, 500);
  }
});

// Get trade history
tradingActivityRoutes.get('/trades', async (c) => {
  try {
    const user = c.get('user');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const mt5AccountId = c.req.query('mt5_account_id');
    const direction = c.req.query('direction');
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');
    const outcome = c.req.query('outcome'); // 'win' or 'loss'

    // Read from PostgreSQL (trading engine now uses PostgreSQL)
    const db = await getDatabase(getDatabaseUrl());

    // Build conditions incrementally
    const conditions = [eq(trades.user_id, user.id)];

    if (mt5AccountId) {
      conditions.push(eq(trades.mt5_account_id, mt5AccountId));
    }

    if (direction) {
      conditions.push(eq(trades.direction, direction as 'BUY' | 'SELL'));
    }

    if (dateFrom) {
      // Start of the day
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      conditions.push(gte(trades.entry_time, fromDate));
    }

    if (dateTo) {
      // End of the day (23:59:59.999) to include all trades on that date
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(trades.entry_time, toDate));
    }

    if (outcome) {
      if (outcome === 'win') {
        conditions.push(sql`${trades.pnl} > 0`);
      } else if (outcome === 'loss') {
        conditions.push(sql`${trades.pnl} < 0`);
      }
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const results = await db.select()
      .from(trades)
      .where(whereClause)
      .orderBy(desc(trades.entry_time))
      .limit(limit)
      .offset(offset);

    // Get total count with same conditions
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(trades)
      .where(whereClause);

    console.log('[Trades API] Reading from PostgreSQL:', {
      total: Number(countResult.count),
      returned: results.length,
    });

    return c.json({
      trades: results,
      pagination: {
        limit,
        offset,
        total: Number(countResult.count),
      },
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return c.json({ error: 'Failed to fetch trades' }, 500);
  }
});

// Get single trade details
tradingActivityRoutes.get('/trades/:id', async (c) => {
  try {
    const user = c.get('user');
    const tradeId = c.req.param('id');
    const db = await getDatabase(getDatabaseUrl());

    const [trade] = await db.select()
      .from(trades)
      .where(and(
        eq(trades.id, tradeId),
        eq(trades.user_id, user.id)
      ))
      .limit(1);

    if (!trade) {
      return c.json({ error: 'Trade not found' }, 404);
    }

    // TODO: Include chart replay data (candlestick data for entry/exit period)
    // This would require fetching market data from a separate service or database

    return c.json(trade);
  } catch (error) {
    console.error('Error fetching trade:', error);
    return c.json({ error: 'Failed to fetch trade' }, 500);
  }
});

// Get circuit breaker events
tradingActivityRoutes.get('/circuit-breaker-events', async (c) => {
  try {
    const user = c.get('user');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const mt5AccountId = c.req.query('mt5_account_id');

    const db = await getDatabase(getDatabaseUrl());

    // Build conditions incrementally
    const conditions = [eq(circuitBreakerEvents.user_id, user.id)];

    if (mt5AccountId) {
      conditions.push(eq(circuitBreakerEvents.mt5_account_id, mt5AccountId));
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const results = await db.select()
      .from(circuitBreakerEvents)
      .where(whereClause)
      .orderBy(desc(circuitBreakerEvents.timestamp))
      .limit(limit)
      .offset(offset);

    return c.json(results);
  } catch (error) {
    console.error('Error fetching circuit breaker events:', error);
    return c.json({ error: 'Failed to fetch circuit breaker events' }, 500);
  }
});

// Export trades to CSV
tradingActivityRoutes.get('/export-trades', async (c) => {
  try {
    const user = c.get('user');
    const mt5AccountId = c.req.query('mt5_account_id');
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');

    const db = await getDatabase(getDatabaseUrl());

    // Build conditions incrementally
    const conditions = [eq(trades.user_id, user.id)];

    if (mt5AccountId) {
      conditions.push(eq(trades.mt5_account_id, mt5AccountId));
    }

    if (dateFrom) {
      conditions.push(gte(trades.entry_time, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(trades.entry_time, new Date(dateTo)));
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const tradeList = await db.select()
      .from(trades)
      .where(whereClause)
      .orderBy(desc(trades.entry_time));

    // Generate CSV
    const headers = [
      'ID',
      'Ticket',
      'Direction',
      'Entry Price',
      'Exit Price',
      'Lot Size',
      'Stop Loss',
      'Take Profit',
      'Entry Time',
      'Exit Time',
      'P&L',
      'Hold Time (seconds)',
      'Exit Reason',
    ];

    const rows = tradeList.map((trade) => [
      trade.id,
      trade.ticket,
      trade.direction,
      trade.entry_price,
      trade.exit_price || '',
      trade.lot_size,
      trade.stop_loss,
      trade.take_profit,
      trade.entry_time.toISOString(),
      trade.exit_time?.toISOString() || '',
      trade.pnl || '',
      trade.hold_time_seconds || '',
      trade.exit_reason || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return c.text(csv, 200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="trades_${new Date().toISOString().split('T')[0]}.csv"`,
    });
  } catch (error) {
    console.error('Error exporting trades:', error);
    return c.json({ error: 'Failed to export trades' }, 500);
  }
});

export default tradingActivityRoutes;

