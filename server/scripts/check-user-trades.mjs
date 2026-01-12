/**
 * Check trades in PostgreSQL database for a specific user
 * Usage: node scripts/check-user-trades.mjs [user_email]
 */
import { getDatabase } from '../src/lib/db.js';
import { getDatabaseUrl } from '../src/lib/env.js';
import { trades } from '../src/schema/trading_activity.js';
import { eq, sql } from 'drizzle-orm';

async function checkUserTrades(userEmail) {
  try {
    const db = await getDatabase(getDatabaseUrl());
    
    // If user email provided, we need to get user_id first
    // For now, let's check all trades and show user info
    console.log('='.repeat(80));
    console.log('CHECKING TRADES IN DATABASE');
    console.log('='.repeat(80));
    console.log();

    // Get all trades with user info
    const allTrades = await db.select({
      id: trades.id,
      user_id: trades.user_id,
      mt5_account_id: trades.mt5_account_id,
      ticket: trades.ticket,
      direction: trades.direction,
      entry_price: trades.entry_price,
      exit_price: trades.exit_price,
      entry_time: trades.entry_time,
      exit_time: trades.exit_time,
      pnl: trades.pnl,
      lot_size: trades.lot_size,
    })
      .from(trades)
      .orderBy(sql`${trades.entry_time} DESC`)
      .limit(100);

    console.log(`Total trades found: ${allTrades.length}`);
    console.log();

    if (allTrades.length === 0) {
      console.log('❌ No trades found in the database.');
      console.log();
      console.log('Possible reasons:');
      console.log('1. No trades have been executed yet');
      console.log('2. Trades are stored in a different database');
      console.log('3. Database connection issue');
      return;
    }

    // Group by user_id
    const tradesByUser = {};
    allTrades.forEach(trade => {
      if (!tradesByUser[trade.user_id]) {
        tradesByUser[trade.user_id] = [];
      }
      tradesByUser[trade.user_id].push(trade);
    });

    console.log(`Trades found for ${Object.keys(tradesByUser).length} user(s):`);
    console.log();

    for (const [userId, userTrades] of Object.entries(tradesByUser)) {
      console.log(`User ID: ${userId}`);
      console.log(`  Total trades: ${userTrades.length}`);
      
      const completedTrades = userTrades.filter(t => t.exit_time !== null);
      const openTrades = userTrades.filter(t => t.exit_time === null);
      
      console.log(`  Completed: ${completedTrades.length}`);
      console.log(`  Open: ${openTrades.length}`);
      
      if (completedTrades.length > 0) {
        const totalPnL = completedTrades.reduce((sum, t) => sum + (parseFloat(t.pnl || 0)), 0);
        const wins = completedTrades.filter(t => parseFloat(t.pnl || 0) > 0).length;
        console.log(`  Total P&L: $${totalPnL.toFixed(2)}`);
        console.log(`  Win Rate: ${((wins / completedTrades.length) * 100).toFixed(1)}%`);
      }
      
      console.log();
      console.log('  Recent trades (last 10):');
      userTrades.slice(0, 10).forEach(trade => {
        const status = trade.exit_time ? 'Closed' : 'Open';
        const pnl = trade.pnl ? parseFloat(trade.pnl).toFixed(2) : 'N/A';
        console.log(`    ${trade.ticket} | ${trade.direction} | Entry: $${trade.entry_price} | ${status} | P&L: $${pnl} | ${trade.entry_time}`);
      });
      console.log();
    }

    // Show date range
    const oldestTrade = allTrades[allTrades.length - 1];
    const newestTrade = allTrades[0];
    console.log('Date Range:');
    console.log(`  Oldest: ${oldestTrade.entry_time}`);
    console.log(`  Newest: ${newestTrade.entry_time}`);
    console.log();

  } catch (error) {
    console.error('Error checking trades:', error);
    process.exit(1);
  }
}

// Get user email from command line args if provided
const userEmail = process.argv[2];

if (userEmail) {
  console.log(`Checking trades for user: ${userEmail}`);
  console.log();
}

checkUserTrades(userEmail)
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


