import { Hono } from 'hono';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import { trades, tradingSignals } from '../schema/trading_activity';
import { eq, and, gte, lte, sql, isNotNull } from 'drizzle-orm';

const analyticsRoutes = new Hono();

// Get performance metrics
analyticsRoutes.get('/performance-metrics', async (c) => {
  try {
    const user = c.get('user');
    const mt5AccountId = c.req.query('mt5_account_id');
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');

    const db = await getDatabase(getDatabaseUrl());

    let whereClause = and(
      eq(trades.user_id, user.id),
      isNotNull(trades.exit_time)
    );

    if (mt5AccountId) {
      whereClause = and(whereClause, eq(trades.mt5_account_id, mt5AccountId));
    }

    if (dateFrom) {
      whereClause = and(whereClause, gte(trades.entry_time, new Date(dateFrom)));
    }

    if (dateTo) {
      whereClause = and(whereClause, lte(trades.entry_time, new Date(dateTo)));
    }

    // Get all closed trades
    const closedTrades = await db.select()
      .from(trades)
      .where(whereClause);

    if (closedTrades.length === 0) {
      return c.json({
        total_trades: 0,
        win_rate: 0,
        profit_factor: 0,
        avg_win: 0,
        avg_loss: 0,
        largest_win: 0,
        largest_loss: 0,
        avg_hold_time: 0,
        max_hold_time: 0,
        sharpe_ratio: 0,
        max_drawdown: 0,
        best_day: null,
        worst_day: null,
      });
    }

    // Calculate basic metrics
    const totalTrades = closedTrades.length;
    const wins = closedTrades.filter((t) => t.pnl && parseFloat(t.pnl) > 0);
    const losses = closedTrades.filter((t) => t.pnl && parseFloat(t.pnl) < 0);
    const winRate = (wins.length / totalTrades) * 100;

    const winningPnls = wins.map((t) => parseFloat(t.pnl || '0'));
    const losingPnls = losses.map((t) => Math.abs(parseFloat(t.pnl || '0')));

    const totalWins = winningPnls.reduce((sum, pnl) => sum + pnl, 0);
    const totalLosses = losingPnls.reduce((sum, pnl) => sum + pnl, 0);
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    const avgWin = winningPnls.length > 0 ? totalWins / winningPnls.length : 0;
    const avgLoss = losingPnls.length > 0 ? totalLosses / losingPnls.length : 0;
    const largestWin = winningPnls.length > 0 ? Math.max(...winningPnls) : 0;
    const largestLoss = losingPnls.length > 0 ? Math.max(...losingPnls) : 0;

    const holdTimes = closedTrades
      .map((t) => t.hold_time_seconds || 0)
      .filter((t) => t > 0);
    const avgHoldTime = holdTimes.length > 0
      ? holdTimes.reduce((sum, t) => sum + t, 0) / holdTimes.length
      : 0;
    const maxHoldTime = holdTimes.length > 0 ? Math.max(...holdTimes) : 0;

    // Calculate Sharpe ratio (simplified - using daily returns)
    const dailyReturns: { [date: string]: number } = {};
    closedTrades.forEach((trade) => {
      if (trade.pnl && trade.entry_time) {
        const date = trade.entry_time.toISOString().split('T')[0];
        dailyReturns[date] = (dailyReturns[date] || 0) + parseFloat(trade.pnl);
      }
    });

    const returns = Object.values(dailyReturns);
    let sharpeRatio = 0;
    if (returns.length > 1) {
      const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);
      sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
    }

    // Calculate max drawdown
    let equity = 0;
    let peakEquity = 0;
    let maxDrawdown = 0;
    const sortedTrades = [...closedTrades].sort((a, b) => {
      const timeA = a.entry_time.getTime();
      const timeB = b.entry_time.getTime();
      return timeA - timeB;
    });

    sortedTrades.forEach((trade) => {
      equity += parseFloat(trade.pnl || '0');
      if (equity > peakEquity) {
        peakEquity = equity;
      }
      const drawdown = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    // Best/worst day
    const dailyPnls: { [date: string]: number } = {};
    closedTrades.forEach((trade) => {
      if (trade.pnl && trade.entry_time) {
        const date = trade.entry_time.toISOString().split('T')[0];
        dailyPnls[date] = (dailyPnls[date] || 0) + parseFloat(trade.pnl);
      }
    });

    const bestDay = Object.entries(dailyPnls).reduce((best, [date, pnl]) => {
      return pnl > best.pnl ? { date, pnl } : best;
    }, { date: '', pnl: -Infinity });

    const worstDay = Object.entries(dailyPnls).reduce((worst, [date, pnl]) => {
      return pnl < worst.pnl ? { date, pnl } : worst;
    }, { date: '', pnl: Infinity });

    return c.json({
      total_trades: totalTrades,
      win_rate: winRate,
      profit_factor: profitFactor,
      avg_win: avgWin,
      avg_loss: avgLoss,
      largest_win: largestWin,
      largest_loss: largestLoss,
      avg_hold_time: avgHoldTime,
      max_hold_time: maxHoldTime,
      sharpe_ratio: sharpeRatio,
      max_drawdown: maxDrawdown,
      best_day: bestDay.pnl !== -Infinity ? bestDay : null,
      worst_day: worstDay.pnl !== Infinity ? worstDay : null,
    });
  } catch (error) {
    console.error('Error calculating performance metrics:', error);
    return c.json({ error: 'Failed to calculate performance metrics' }, 500);
  }
});

// Get time-based analysis
analyticsRoutes.get('/time-analysis', async (c) => {
  try {
    const user = c.get('user');
    const mt5AccountId = c.req.query('mt5_account_id');
    const period = c.req.query('period') || 'month';

    const db = await getDatabase(getDatabaseUrl());

    // Calculate date range based on period
    const now = new Date();
    let dateFrom: Date;
    if (period === 'day') {
      dateFrom = new Date(now.setHours(0, 0, 0, 0));
    } else if (period === 'week') {
      dateFrom = new Date(now.setDate(now.getDate() - 7));
    } else {
      dateFrom = new Date(now.setMonth(now.getMonth() - 1));
    }

    let whereClause = and(
      eq(trades.user_id, user.id),
      isNotNull(trades.exit_time),
      gte(trades.entry_time, dateFrom)
    );

    if (mt5AccountId) {
      whereClause = and(whereClause, eq(trades.mt5_account_id, mt5AccountId));
    }

    const closedTrades = await db.select()
      .from(trades)
      .where(whereClause);

    // By hour of day (0-23)
    const byHour: { [hour: number]: { trades: number; wins: number; pnl: number } } = {};
    for (let i = 0; i < 24; i++) {
      byHour[i] = { trades: 0, wins: 0, pnl: 0 };
    }

    closedTrades.forEach((trade) => {
      if (trade.entry_time) {
        const hour = trade.entry_time.getUTCHours();
        byHour[hour].trades++;
        if (trade.pnl && parseFloat(trade.pnl) > 0) {
          byHour[hour].wins++;
        }
        byHour[hour].pnl += parseFloat(trade.pnl || '0');
      }
    });

    const byHourArray = Object.entries(byHour).map(([hour, data]) => ({
      hour: parseInt(hour),
      trades: data.trades,
      win_rate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      pnl: data.pnl,
    }));

    // By day of week (0=Sunday, 6=Saturday)
    const byDayOfWeek: { [day: number]: { trades: number; wins: number; pnl: number } } = {};
    for (let i = 0; i < 7; i++) {
      byDayOfWeek[i] = { trades: 0, wins: 0, pnl: 0 };
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    closedTrades.forEach((trade) => {
      if (trade.entry_time) {
        const day = trade.entry_time.getUTCDay();
        byDayOfWeek[day].trades++;
        if (trade.pnl && parseFloat(trade.pnl) > 0) {
          byDayOfWeek[day].wins++;
        }
        byDayOfWeek[day].pnl += parseFloat(trade.pnl || '0');
      }
    });

    const byDayOfWeekArray = Object.entries(byDayOfWeek).map(([day, data]) => ({
      day: dayNames[parseInt(day)],
      trades: data.trades,
      win_rate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      pnl: data.pnl,
    }));

    // By session
    const sessionRanges = [
      { name: 'London Open', start: 8, end: 9.5 },
      { name: 'London-NY Overlap', start: 13, end: 15 },
      { name: 'NY Data Releases', start: 14.5, end: 15.5 },
      { name: 'London Morning', start: 9.5, end: 13 },
      { name: 'NY Afternoon', start: 15.5, end: 17 },
    ];

    const bySession: { [session: string]: { trades: number; wins: number; pnl: number } } = {};
    sessionRanges.forEach((session) => {
      bySession[session.name] = { trades: 0, wins: 0, pnl: 0 };
    });

    closedTrades.forEach((trade) => {
      if (trade.entry_time) {
        const hour = trade.entry_time.getUTCHours() + trade.entry_time.getUTCMinutes() / 60;
        const session = sessionRanges.find((s) => hour >= s.start && hour < s.end);
        if (session) {
          bySession[session.name].trades++;
          if (trade.pnl && parseFloat(trade.pnl) > 0) {
            bySession[session.name].wins++;
          }
          bySession[session.name].pnl += parseFloat(trade.pnl || '0');
        }
      }
    });

    const bySessionArray = Object.entries(bySession).map(([session, data]) => ({
      session,
      trades: data.trades,
      win_rate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      pnl: data.pnl,
    }));

    return c.json({
      by_hour: byHourArray,
      by_day_of_week: byDayOfWeekArray,
      by_session: bySessionArray,
    });
  } catch (error) {
    console.error('Error calculating time analysis:', error);
    return c.json({ error: 'Failed to calculate time analysis' }, 500);
  }
});

// Get signal analysis
analyticsRoutes.get('/signal-analysis', async (c) => {
  try {
    const user = c.get('user');
    const mt5AccountId = c.req.query('mt5_account_id');
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');

    const db = await getDatabase(getDatabaseUrl());

    let whereClause = and(eq(tradingSignals.user_id, user.id));

    if (mt5AccountId) {
      whereClause = and(whereClause, eq(tradingSignals.mt5_account_id, mt5AccountId));
    }

    if (dateFrom) {
      whereClause = and(whereClause, gte(tradingSignals.timestamp, new Date(dateFrom)));
    }

    if (dateTo) {
      whereClause = and(whereClause, lte(tradingSignals.timestamp, new Date(dateTo)));
    }

    const signals = await db.select()
      .from(tradingSignals)
      .where(whereClause);

    const totalSignals = signals.length;
    const approved = signals.filter((s) => s.became_trade).length;
    const approvalRate = totalSignals > 0 ? (approved / totalSignals) * 100 : 0;

    // Rejection reasons
    const rejectionReasons: { [reason: string]: number } = {};
    signals
      .filter((s) => !s.became_trade && s.rejection_reason)
      .forEach((s) => {
        const reason = s.rejection_reason || 'unknown';
        rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
      });

    const rejectionReasonsArray = Object.entries(rejectionReasons).map(([reason, count]) => ({
      reason,
      count,
    }));

    // Confidence vs outcome (join with trades)
    const confidenceRanges = [
      { range: '0-50', min: 0, max: 50 },
      { range: '50-60', min: 50, max: 60 },
      { range: '60-70', min: 60, max: 70 },
      { range: '70-80', min: 70, max: 80 },
      { range: '80-90', min: 80, max: 90 },
      { range: '90-100', min: 90, max: 100 },
    ];

    // Get trades that came from signals (now using signal_id field)
    const tradesWithSignals = await db.select({
      signal_id: trades.signal_id,
      pnl: trades.pnl,
    })
      .from(trades)
      .where(and(
        eq(trades.user_id, user.id),
        isNotNull(trades.exit_time),
        sql`${trades.signal_id} IS NOT NULL`
      ));

    // Match signals with trades using signal_id
    const confidenceVsOutcome = confidenceRanges.map((range) => {
      // Find signals in this confidence range that became trades
      const rangeSignals = signals.filter((s) => {
        const conf = parseFloat(s.confidence);
        return conf >= range.min && conf < range.max && s.became_trade;
      });

      // Get trade outcomes for these signals
      const signalIds = new Set(rangeSignals.map(s => s.id));
      const rangeTrades = tradesWithSignals.filter(t => t.signal_id && signalIds.has(t.signal_id));
      
      const wins = rangeTrades.filter(t => t.pnl && parseFloat(t.pnl) > 0).length;
      const winRate = rangeTrades.length > 0 ? (wins / rangeTrades.length) * 100 : 0;

      return {
        confidence_range: range.range,
        win_rate: winRate,
        trades: rangeTrades.length,
      };
    });

    return c.json({
      total_signals: totalSignals,
      approval_rate: approvalRate,
      rejection_reasons: rejectionReasonsArray,
      confidence_vs_outcome: confidenceVsOutcome,
    });
  } catch (error) {
    console.error('Error calculating signal analysis:', error);
    return c.json({ error: 'Failed to calculate signal analysis' }, 500);
  }
});

export default analyticsRoutes;

