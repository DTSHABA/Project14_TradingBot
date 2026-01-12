/**
 * SQLite Reader Service
 * Reads trades from the trading engine's SQLite database
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileExists } from './file-utils';

export interface SQLiteTrade {
  id: number;
  ticket: number;
  symbol: string;
  direction: string;
  entry_price: number;
  lot_size: number;
  stop_loss: number;
  take_profit: number;
  entry_time: string;
  exit_time: string | null;
  pnl: number | null;
  exit_reason: string | null;
  hold_time_seconds: number | null;
  partial_closed: number;
  partial_closed_percent: number;
  created_at: string;
  updated_at: string;
}

export interface SQLiteSignal {
  id: number;
  direction: string;
  entry_type: string;
  confidence: number;
  timestamp: string;
  reason: string | null;
  price: number;
  executed: number;
  created_at: string;
}

class SQLiteReader {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    if (dbPath) {
      this.dbPath = dbPath;
    } else {
      // Check for environment variable first
      const envPath = process.env.SQLITE_DB_PATH;
      if (envPath) {
        this.dbPath = envPath;
      } else {
        // Default to trading-engine/trading_engine.db relative to project root
        // process.cwd() in server/ directory, so go up one level to project root
        const projectRoot = path.resolve(process.cwd(), '..');
        this.dbPath = path.join(projectRoot, 'trading-engine', 'trading_engine.db');
      }
    }
  }

  /**
   * Get the SQLite database path
   */
  getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Check if SQLite database exists
   */
  async exists(): Promise<boolean> {
    try {
      return await fileExists(this.dbPath);
    } catch {
      return false;
    }
  }

  /**
   * Connect to SQLite database
   */
  connect(): void {
    if (this.db) {
      return; // Already connected
    }

    try {
      this.db = new Database(this.dbPath, { readonly: true });
      // Enable foreign keys and other optimizations
      this.db.pragma('journal_mode = WAL');
    } catch (error) {
      console.error(`Failed to connect to SQLite database at ${this.dbPath}:`, error);
      throw new Error(`SQLite database not accessible: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disconnect from SQLite database
   */
  disconnect(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Get all trades from SQLite
   */
  getTrades(options: {
    limit?: number;
    offset?: number;
    direction?: 'BUY' | 'SELL';
    dateFrom?: Date;
    dateTo?: Date;
    outcome?: 'win' | 'loss';
  } = {}): { trades: SQLiteTrade[]; total: number } {
    if (!this.db) {
      this.connect();
    }

    const {
      limit = 50,
      offset = 0,
      direction,
      dateFrom,
      dateTo,
      outcome,
    } = options;

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: any[] = [];

    if (direction) {
      // SQLite stores direction as lowercase ('buy'/'sell'), but we need to match it
      const sqliteDirection = direction.toLowerCase();
      conditions.push('LOWER(direction) = ?');
      params.push(sqliteDirection);
    }

    if (dateFrom) {
      conditions.push('entry_time >= ?');
      params.push(dateFrom.toISOString());
    }

    if (dateTo) {
      // End of day
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      conditions.push('entry_time <= ?');
      params.push(endDate.toISOString());
    }

    if (outcome === 'win') {
      conditions.push('pnl > 0');
    } else if (outcome === 'loss') {
      conditions.push('pnl < 0');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM trades ${whereClause}`;
    const countResult = this.db!.prepare(countQuery).get(params) as { total: number };
    const total = countResult.total;

    // Get trades
    const query = `
      SELECT * FROM trades 
      ${whereClause}
      ORDER BY entry_time DESC 
      LIMIT ? OFFSET ?
    `;
    const allParams = [...params, limit, offset];
    const trades = this.db!.prepare(query).all(allParams) as SQLiteTrade[];

    return { trades, total };
  }

  /**
   * Get trade by ticket number
   */
  getTradeByTicket(ticket: number): SQLiteTrade | null {
    if (!this.db) {
      this.connect();
    }

    const query = 'SELECT * FROM trades WHERE ticket = ? LIMIT 1';
    const trade = this.db!.prepare(query).get(ticket) as SQLiteTrade | undefined;
    return trade || null;
  }

  /**
   * Get recent signals
   */
  getSignals(options: {
    limit?: number;
    offset?: number;
  } = {}): SQLiteSignal[] {
    if (!this.db) {
      this.connect();
    }

    const { limit = 50, offset = 0 } = options;
    const query = `
      SELECT * FROM signals 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `;
    return this.db!.prepare(query).all(limit, offset) as SQLiteSignal[];
  }

  /**
   * Get trade statistics
   */
  getTradeStats(): {
    total: number;
    completed: number;
    open: number;
    wins: number;
    losses: number;
    totalPnl: number;
  } {
    if (!this.db) {
      this.connect();
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN exit_time IS NOT NULL THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN exit_time IS NULL THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
        COALESCE(SUM(pnl), 0) as totalPnl
      FROM trades
    `;
    const stats = this.db!.prepare(statsQuery).get() as {
      total: number;
      completed: number;
      open: number;
      wins: number;
      losses: number;
      totalPnl: number;
    };

    return {
      total: stats.total || 0,
      completed: stats.completed || 0,
      open: stats.open || 0,
      wins: stats.wins || 0,
      losses: stats.losses || 0,
      totalPnl: stats.totalPnl || 0,
    };
  }
}

// Singleton instance
let sqliteReader: SQLiteReader | null = null;

/**
 * Get SQLite reader instance
 */
export function getSQLiteReader(dbPath?: string): SQLiteReader {
  if (!sqliteReader) {
    sqliteReader = new SQLiteReader(dbPath);
  }
  return sqliteReader;
}

/**
 * Convert SQLite trade to PostgreSQL trade format
 */
export function convertSQLiteTradeToPostgresTrade(
  sqliteTrade: SQLiteTrade,
  userId: string,
  mt5AccountId: string,
  signalId?: string
) {
  return {
    id: `sqlite-${sqliteTrade.ticket}`, // Use ticket as part of ID to ensure uniqueness
    user_id: userId,
    mt5_account_id: mt5AccountId,
    signal_id: signalId || null,
    ticket: sqliteTrade.ticket,
    direction: (sqliteTrade.direction.toUpperCase() === 'BUY' ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
    entry_price: sqliteTrade.entry_price.toString(),
    exit_price: sqliteTrade.exit_price ? sqliteTrade.exit_price.toString() : null,
    lot_size: sqliteTrade.lot_size.toString(),
    stop_loss: sqliteTrade.stop_loss.toString(),
    take_profit: sqliteTrade.take_profit.toString(),
    entry_time: new Date(sqliteTrade.entry_time),
    exit_time: sqliteTrade.exit_time ? new Date(sqliteTrade.exit_time) : null,
    pnl: sqliteTrade.pnl ? sqliteTrade.pnl.toString() : null,
    hold_time_seconds: sqliteTrade.hold_time_seconds || null,
    exit_reason: sqliteTrade.exit_reason || null,
    partial_exits: sqliteTrade.partial_closed
      ? [
          {
            percent: sqliteTrade.partial_closed_percent,
            price: sqliteTrade.exit_price || sqliteTrade.entry_price,
            time: sqliteTrade.exit_time || sqliteTrade.entry_time,
          },
        ]
      : [],
  };
}

