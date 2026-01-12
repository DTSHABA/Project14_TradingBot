"""
PostgreSQL database schema and operations for trading engine with connection pooling.
"""
import os
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from datetime import datetime
from typing import List, Dict, Any, Optional
from uuid import uuid4
from ..utils.types import Signal, Trade


class Database:
    """PostgreSQL database operations for trade history and analytics with connection pooling."""
    
    def __init__(self, connection_string: Optional[str] = None, 
                 user_id: Optional[str] = None,
                 mt5_account_id: Optional[str] = None,
                 db_path: Optional[str] = None,  # Legacy parameter for backward compatibility
                 min_connections: int = 2,
                 max_connections: int = 10):
        """
        Initialize database connection pool.
        
        Args:
            connection_string: PostgreSQL connection string (or use DATABASE_URL env var)
            user_id: User ID for this trading engine instance
            mt5_account_id: MT5 account ID for this trading engine instance
            db_path: Legacy parameter (ignored, kept for backward compatibility)
            min_connections: Minimum pool connections
            max_connections: Maximum pool connections
        """
        # Get connection string from parameter, env var, or default
        self.connection_string = (
            connection_string or 
            os.getenv('DATABASE_URL') or 
            os.getenv('POSTGRES_URL') or
            'postgresql://postgres:password@localhost:5502/postgres'
        )
        
        # Get user_id and mt5_account_id from parameter or env vars
        self.user_id = user_id or os.getenv('TRADING_ENGINE_USER_ID')
        self.mt5_account_id = mt5_account_id or os.getenv('TRADING_ENGINE_MT5_ACCOUNT_ID')
        
        if not self.user_id or not self.mt5_account_id:
            # Provide helpful error message with file path
            missing = []
            if not self.user_id:
                missing.append('TRADING_ENGINE_USER_ID')
            if not self.mt5_account_id:
                missing.append('TRADING_ENGINE_MT5_ACCOUNT_ID')
            
            # Check if .env file exists
            from pathlib import Path
            trading_engine_dir = Path(__file__).parent.parent.parent
            env_file = trading_engine_dir / '.env'
            env_exists = env_file.exists()
            
            error_msg = (
                f"Missing required configuration: {', '.join(missing)}\n\n"
            )
            
            if not env_exists:
                error_msg += (
                    f"❌ .env file NOT FOUND at: {env_file}\n\n"
                    f"📝 SOLUTION: Create a .env file in the trading-engine directory:\n"
                    f"   Location: {env_file}\n\n"
                    f"   Required content:\n"
                    f"   TRADING_ENGINE_USER_ID=your_user_id\n"
                    f"   TRADING_ENGINE_MT5_ACCOUNT_ID=your_mt5_account_id\n"
                    f"   DATABASE_URL=postgresql://user:password@host:port/database\n"
                    f"   MT5_LOGIN=your_mt5_account_number\n"
                    f"   MT5_PASSWORD=your_mt5_password\n"
                    f"   MT5_SERVER=your_mt5_server\n"
                    f"   MT5_SYMBOL=XAUUSD\n\n"
                    f"💡 TIP: Run 'python create_env_file.py' to create it interactively\n"
                )
            else:
                error_msg += (
                    f"✅ .env file EXISTS at: {env_file}\n"
                    f"❌ But missing variables: {', '.join(missing)}\n\n"
                    f"📝 SOLUTION: Add these to your .env file:\n"
                )
                for var in missing:
                    error_msg += f"   {var}=your_value_here\n"
            
            raise ValueError(error_msg)
        
        # Create connection pool
        try:
            self.connection_pool = psycopg2.pool.ThreadedConnectionPool(
                min_connections,
                max_connections,
                self.connection_string
            )
        except Exception as e:
            raise ConnectionError(f"Failed to create database connection pool: {e}")
        
        # Initialize schema
        self.initialize_schema()
    
    def _get_connection(self):
        """Get a connection from the pool."""
        return self.connection_pool.getconn()
    
    def _return_connection(self, conn):
        """Return a connection to the pool."""
        self.connection_pool.putconn(conn)
    
    def initialize_schema(self) -> None:
        """Ensure database tables exist (schema is managed by migrations, but we verify)."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cursor:
                # Verify tables exist by checking if trades table exists
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'app' 
                        AND table_name = 'trades'
                    );
                """)
                exists = cursor.fetchone()[0]
                
                if not exists:
                    raise RuntimeError(
                        "Database schema not initialized. Please run migrations first. "
                        "Tables should exist in the 'app' schema."
                    )
                
                conn.commit()
        except Exception as e:
            conn.rollback()
            raise RuntimeError(f"Failed to verify database schema: {e}")
        finally:
            self._return_connection(conn)
    
    def record_signal(self, signal: Signal, signal_id: Optional[str] = None) -> str:
        """
        Store generated signal.
        
        Args:
            signal: Signal object to store
            signal_id: Optional signal ID (if not provided, generates UUID)
        
        Returns:
            Signal ID
        """
        if signal_id is None:
            signal_id = str(uuid4())
        
        # Map signal direction to PostgreSQL enum
        signal_type = signal.direction.upper()
        if signal_type not in ['BUY', 'SELL']:
            signal_type = 'HOLD'
        
        conn = self._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO app.trading_signals 
                    (id, user_id, mt5_account_id, signal_type, confidence, timestamp, price, reason, became_trade)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        confidence = EXCLUDED.confidence,
                        timestamp = EXCLUDED.timestamp,
                        price = EXCLUDED.price,
                        reason = EXCLUDED.reason
                """, (
                    signal_id,
                    self.user_id,
                    self.mt5_account_id,
                    signal_type,
                    signal.confidence,
                    signal.timestamp,
                    signal.price,
                    signal.reason,
                    False  # became_trade
                ))
                conn.commit()
                return signal_id
        except Exception as e:
            conn.rollback()
            raise RuntimeError(f"Failed to record signal: {e}")
        finally:
            self._return_connection(conn)
    
    def record_trade(self, trade: Trade, trade_id: Optional[str] = None, signal_id: Optional[str] = None) -> None:
        """
        Store executed trade.
        
        Args:
            trade: Trade object to store
            trade_id: Optional trade ID (if not provided, generates UUID)
            signal_id: Optional signal ID that generated this trade
        
        Returns:
            None (for backward compatibility with SQLite version)
        """
        if trade_id is None:
            trade_id = str(uuid4())
        
        # Map direction to PostgreSQL enum
        direction = trade.direction.upper()
        if direction not in ['BUY', 'SELL']:
            raise ValueError(f"Invalid trade direction: {trade.direction}")
        
        # Handle partial exits
        partial_exits = []
        if hasattr(trade, 'partial_closed') and trade.partial_closed:
            exit_price = getattr(trade, 'exit_price', None)
            partial_exits = [{
                'percent': getattr(trade, 'partial_closed_percent', 0),
                'price': exit_price or trade.entry_price,
                'time': (trade.exit_time or trade.entry_time).isoformat()
            }]
        
        conn = self._get_connection()
        try:
            with conn.cursor() as cursor:
                # Use ON CONFLICT with ticket to handle updates
                # Check if trade exists first
                cursor.execute("""
                    SELECT id FROM app.trades 
                    WHERE ticket = %s AND user_id = %s AND mt5_account_id = %s
                """, (trade.ticket, self.user_id, self.mt5_account_id))
                
                existing = cursor.fetchone()
                
                if existing:
                    # Update existing trade
                    # Note: exit_price may not exist on Trade object
                    exit_price = getattr(trade, 'exit_price', None)
                    cursor.execute("""
                        UPDATE app.trades 
                        SET exit_price = %s, exit_time = %s, pnl = %s, exit_reason = %s,
                            hold_time_seconds = %s, partial_exits = %s::jsonb, lot_size = %s
                        WHERE ticket = %s AND user_id = %s AND mt5_account_id = %s
                    """, (
                        exit_price,  # Use getattr result
                        trade.exit_time,
                        trade.pnl,
                        trade.exit_reason,
                        int(trade.hold_time_seconds) if trade.hold_time_seconds else None,
                        partial_exits,
                        trade.lot_size,
                        trade.ticket,
                        self.user_id,
                        self.mt5_account_id
                    ))
                else:
                    # Insert new trade
                    # Note: exit_price may not exist on Trade object when recording entry
                    exit_price = getattr(trade, 'exit_price', None)
                    cursor.execute("""
                        INSERT INTO app.trades 
                        (id, user_id, mt5_account_id, signal_id, ticket, direction, entry_price, 
                         exit_price, lot_size, stop_loss, take_profit, entry_time, exit_time, 
                         pnl, exit_reason, hold_time_seconds, partial_exits)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                    """, (
                        trade_id,
                        self.user_id,
                        self.mt5_account_id,
                        signal_id,
                        trade.ticket,
                        direction,
                        trade.entry_price,
                        exit_price,  # Use getattr result
                        trade.lot_size,
                        trade.stop_loss,
                        trade.take_profit,
                        trade.entry_time,
                        trade.exit_time,
                        trade.pnl,
                        trade.exit_reason,
                        int(trade.hold_time_seconds) if trade.hold_time_seconds else None,
                        partial_exits
                    ))
                conn.commit()
        except Exception as e:
            conn.rollback()
            raise RuntimeError(f"Failed to record trade: {e}")
        finally:
            self._return_connection(conn)
    
    def update_trade_exit(self, ticket: int, exit_price: float, pnl: float, 
                         exit_time: datetime, exit_reason: str, hold_time_seconds: float) -> None:
        """
        Update trade with exit information.
        
        Args:
            ticket: Trade ticket number
            exit_price: Exit price
            pnl: Profit/loss
            exit_time: Exit timestamp
            exit_reason: Reason for exit
            hold_time_seconds: Time position was held
        """
        conn = self._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE app.trades 
                    SET exit_price = %s, pnl = %s, exit_reason = %s, 
                        hold_time_seconds = %s, exit_time = %s
                    WHERE ticket = %s AND user_id = %s AND mt5_account_id = %s
                """, (
                    exit_price, pnl, exit_reason, int(hold_time_seconds), 
                    exit_time, ticket, self.user_id, self.mt5_account_id
                ))
                conn.commit()
        except Exception as e:
            conn.rollback()
            raise RuntimeError(f"Failed to update trade exit: {e}")
        finally:
            self._return_connection(conn)
    
    def update_trade_partial_close(self, ticket: int, closed_percent: float, remaining_lots: float,
                                  exit_price: Optional[float] = None, exit_time: Optional[datetime] = None) -> None:
        """
        Update trade after partial exit.
        
        Args:
            ticket: Trade ticket number
            closed_percent: Percentage of position closed
            remaining_lots: Remaining lot size
            exit_price: Optional exit price for partial close
            exit_time: Optional exit time for partial close
        """
        conn = self._get_connection()
        try:
            with conn.cursor() as cursor:
                # Get existing partial_exits
                cursor.execute("""
                    SELECT partial_exits FROM app.trades 
                    WHERE ticket = %s AND user_id = %s AND mt5_account_id = %s
                """, (ticket, self.user_id, self.mt5_account_id))
                
                result = cursor.fetchone()
                if not result:
                    raise ValueError(f"Trade with ticket {ticket} not found")
                
                existing_partial_exits = result[0] or []
                
                # Add new partial exit
                new_partial_exit = {
                    'percent': closed_percent,
                    'price': exit_price or 0.0,
                    'time': (exit_time or datetime.now()).isoformat()
                }
                existing_partial_exits.append(new_partial_exit)
                
                cursor.execute("""
                    UPDATE app.trades 
                    SET partial_exits = %s::jsonb, lot_size = %s
                    WHERE ticket = %s AND user_id = %s AND mt5_account_id = %s
                """, (
                    existing_partial_exits,
                    remaining_lots,
                    ticket,
                    self.user_id,
                    self.mt5_account_id
                ))
                conn.commit()
        except Exception as e:
            conn.rollback()
            raise RuntimeError(f"Failed to update trade partial close: {e}")
        finally:
            self._return_connection(conn)
    
    def get_trade_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Retrieve recent trades for circuit breaker analysis.
        
        Args:
            limit: Number of recent trades to retrieve
        
        Returns:
            List of trade dictionaries
        """
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT * FROM app.trades 
                    WHERE user_id = %s AND mt5_account_id = %s 
                      AND exit_time IS NOT NULL
                    ORDER BY exit_time DESC 
                    LIMIT %s
                """, (self.user_id, self.mt5_account_id, limit))
                
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            raise RuntimeError(f"Failed to get trade history: {e}")
        finally:
            self._return_connection(conn)
    
    def get_session_performance(self, date: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Aggregate session metrics.
        
        Args:
            date: Date to get performance for (default: today)
        
        Returns:
            Dictionary with session metrics
        """
        if date is None:
            date = datetime.now()
        
        date_only = date.date()
        
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Get trades for the date
                cursor.execute("""
                    SELECT 
                        COUNT(*) as trades_count,
                        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
                        SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
                        COALESCE(SUM(pnl), 0) as total_pnl,
                        CASE 
                            WHEN COUNT(*) > 0 THEN 
                                AVG(CASE WHEN pnl > 0 THEN 1.0 ELSE 0.0 END) * 100 
                            ELSE 0 
                        END as win_rate
                    FROM app.trades
                    WHERE user_id = %s AND mt5_account_id = %s
                      AND DATE(entry_time) = %s
                """, (self.user_id, self.mt5_account_id, date_only))
                
                row = cursor.fetchone()
                if row and row['trades_count']:
                    return {
                        'date': date_only.isoformat(),
                        'trades_count': row['trades_count'],
                        'wins': row['wins'] or 0,
                        'losses': row['losses'] or 0,
                        'total_pnl': float(row['total_pnl'] or 0),
                        'win_rate': float(row['win_rate'] or 0)
                    }
                
                return {
                    'date': date_only.isoformat(),
                    'trades_count': 0,
                    'wins': 0,
                    'losses': 0,
                    'total_pnl': 0.0,
                    'win_rate': 0.0
                }
        except Exception as e:
            raise RuntimeError(f"Failed to get session performance: {e}")
        finally:
            self._return_connection(conn)
    
    def record_circuit_breaker_event(self, event_type: str, reason: str, 
                                    halt_start_time: Optional[datetime] = None,
                                    halt_end_time: Optional[datetime] = None,
                                    duration_minutes: int = 0,
                                    loss_count: int = 0,
                                    daily_pnl: float = 0.0) -> str:
        """
        Record circuit breaker event.
        
        Args:
            event_type: Type of event ('halt', 'reset', 'risk_adjustment')
            reason: Reason for the event
            halt_start_time: When halt started
            halt_end_time: When halt ended
            duration_minutes: Duration of halt
            loss_count: Number of losses at time of event
            daily_pnl: Daily P&L at time of event
        
        Returns:
            Event ID
        """
        event_id = str(uuid4())
        
        # Map event_type to PostgreSQL enum
        if event_type not in ['halt', 'reset', 'risk_adjustment']:
            event_type = 'halt'
        
        conn = self._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO app.circuit_breaker_events 
                    (id, user_id, mt5_account_id, event_type, reason, halted_until, timestamp)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    event_id,
                    self.user_id,
                    self.mt5_account_id,
                    event_type,
                    reason,
                    halt_end_time,  # halted_until
                    halt_start_time or datetime.now()
                ))
                conn.commit()
                return event_id
        except Exception as e:
            conn.rollback()
            raise RuntimeError(f"Failed to record circuit breaker event: {e}")
        finally:
            self._return_connection(conn)
    
    def get_recent_signals(self, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Get recent signals.
        
        Args:
            limit: Number of signals to retrieve
        
        Returns:
            List of signal dictionaries
        """
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT * FROM app.trading_signals 
                    WHERE user_id = %s AND mt5_account_id = %s
                    ORDER BY timestamp DESC 
                    LIMIT %s
                """, (self.user_id, self.mt5_account_id, limit))
                
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            raise RuntimeError(f"Failed to get recent signals: {e}")
        finally:
            self._return_connection(conn)
    
    def get_trade_by_ticket(self, ticket: int) -> Optional[Dict[str, Any]]:
        """
        Get trade by ticket number.
        
        Args:
            ticket: Trade ticket number
        
        Returns:
            Trade dictionary or None if not found
        """
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT * FROM app.trades 
                    WHERE ticket = %s AND user_id = %s AND mt5_account_id = %s
                """, (ticket, self.user_id, self.mt5_account_id))
                
                row = cursor.fetchone()
                return dict(row) if row else None
        except Exception as e:
            raise RuntimeError(f"Failed to get trade by ticket: {e}")
        finally:
            self._return_connection(conn)
    
    def close(self) -> None:
        """Close database connection pool."""
        if hasattr(self, 'connection_pool'):
            self.connection_pool.closeall()
