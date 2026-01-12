"""
Database for storing backtest results separately from live trades.
"""
import sqlite3
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from ..utils.types import Signal, Trade
from ..analytics.database import Database


class BacktestDatabase(Database):
    """Extended database for backtest results with is_backtest flag."""
    
    def __init__(self, db_path: str = "backtest_results.db"):
        """
        Initialize backtest database.
        
        Args:
            db_path: Path to SQLite database file
        """
        super().__init__(db_path)
        self._add_backtest_schema()
    
    def _add_backtest_schema(self) -> None:
        """Add backtest-specific schema modifications."""
        cursor = self.conn.cursor()
        
        # Add is_backtest column to trades table if it doesn't exist
        try:
            cursor.execute("ALTER TABLE trades ADD COLUMN is_backtest BOOLEAN DEFAULT 0")
            self.conn.commit()
        except sqlite3.OperationalError:
            # Column already exists
            pass
        
        # Add is_backtest column to signals table if it doesn't exist
        try:
            cursor.execute("ALTER TABLE signals ADD COLUMN is_backtest BOOLEAN DEFAULT 0")
            self.conn.commit()
        except sqlite3.OperationalError:
            # Column already exists
            pass
        
        # Create index for backtest queries
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_trades_backtest ON trades(is_backtest, entry_time)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_signals_backtest ON signals(is_backtest, timestamp)")
        self.conn.commit()
    
    def record_signal(self, signal: Signal, is_backtest: bool = True) -> int:
        """
        Store generated signal with backtest flag.
        
        Args:
            signal: Signal object to store
            is_backtest: Whether this is a backtest signal
        
        Returns:
            Signal ID
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO signals (direction, entry_type, confidence, timestamp, reason, price, is_backtest)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            signal.direction,
            signal.entry_type,
            signal.confidence,
            signal.timestamp,
            signal.reason,
            signal.price,
            1 if is_backtest else 0
        ))
        self.conn.commit()
        return cursor.lastrowid
    
    def record_trade(self, trade: Trade, is_backtest: bool = True) -> None:
        """
        Store executed trade with backtest flag.
        
        Args:
            trade: Trade object to store
            is_backtest: Whether this is a backtest trade
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO trades 
            (ticket, symbol, direction, entry_price, lot_size, stop_loss, take_profit,
             entry_time, exit_time, pnl, exit_reason, hold_time_seconds, is_backtest, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            trade.ticket,
            trade.symbol,
            trade.direction,
            trade.entry_price,
            trade.lot_size,
            trade.stop_loss,
            trade.take_profit,
            trade.entry_time,
            trade.exit_time,
            trade.pnl,
            trade.exit_reason,
            trade.hold_time_seconds,
            1 if is_backtest else 0,
            datetime.now()
        ))
        self.conn.commit()
    
    def get_backtest_trades(self, start_date: Optional[datetime] = None,
                           end_date: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Get all backtest trades, optionally filtered by date range.
        
        Args:
            start_date: Optional start date filter
            end_date: Optional end date filter
        
        Returns:
            List of trade dictionaries
        """
        cursor = self.conn.cursor()
        
        query = "SELECT * FROM trades WHERE is_backtest = 1"
        params = []
        
        if start_date:
            query += " AND entry_time >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND entry_time <= ?"
            params.append(end_date)
        
        query += " ORDER BY entry_time ASC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    
    def get_backtest_signals(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get backtest signals.
        
        Args:
            limit: Optional limit on number of signals
        
        Returns:
            List of signal dictionaries
        """
        cursor = self.conn.cursor()
        
        query = "SELECT * FROM signals WHERE is_backtest = 1 ORDER BY timestamp DESC"
        if limit:
            query += f" LIMIT {limit}"
        
        cursor.execute(query)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    
    def get_backtest_summary(self) -> Dict[str, Any]:
        """
        Get summary statistics for all backtest trades.
        
        Returns:
            Dictionary with summary statistics
        """
        cursor = self.conn.cursor()
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total_trades,
                SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
                SUM(pnl) as total_pnl,
                AVG(CASE WHEN pnl > 0 THEN pnl ELSE NULL END) as avg_win,
                AVG(CASE WHEN pnl < 0 THEN pnl ELSE NULL END) as avg_loss,
                MIN(pnl) as worst_trade,
                MAX(pnl) as best_trade,
                AVG(hold_time_seconds) as avg_hold_time
            FROM trades
            WHERE is_backtest = 1 AND exit_time IS NOT NULL
        """)
        
        row = cursor.fetchone()
        if row and row['total_trades']:
            win_rate = (row['wins'] / row['total_trades']) * 100 if row['total_trades'] > 0 else 0
            profit_factor = abs(row['avg_win'] / row['avg_loss']) if row['avg_loss'] and row['avg_loss'] != 0 else 0
            
            return {
                'total_trades': row['total_trades'],
                'wins': row['wins'] or 0,
                'losses': row['losses'] or 0,
                'win_rate': win_rate,
                'total_pnl': row['total_pnl'] or 0.0,
                'average_win': row['avg_win'] or 0.0,
                'average_loss': row['avg_loss'] or 0.0,
                'worst_trade': row['worst_trade'] or 0.0,
                'best_trade': row['best_trade'] or 0.0,
                'profit_factor': profit_factor,
                'average_hold_time_seconds': row['avg_hold_time'] or 0.0
            }
        
        return {
            'total_trades': 0,
            'wins': 0,
            'losses': 0,
            'win_rate': 0.0,
            'total_pnl': 0.0,
            'average_win': 0.0,
            'average_loss': 0.0,
            'worst_trade': 0.0,
            'best_trade': 0.0,
            'profit_factor': 0.0,
            'average_hold_time_seconds': 0.0
        }

