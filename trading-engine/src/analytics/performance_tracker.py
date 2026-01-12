"""
Calculates win rate, P&L, and performance metrics.
"""
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from ..analytics.database import Database
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class PerformanceTracker:
    """Tracks and calculates performance metrics."""
    
    def __init__(self, database: Database):
        """
        Initialize performance tracker.
        
        Args:
            database: Database instance
        """
        self.database = database
    
    def _parse_datetime(self, dt_str: str) -> Optional[datetime]:
        """
        Parse datetime string from database (handles ISO and SQLite formats).
        
        Args:
            dt_str: Datetime string from database
        
        Returns:
            Parsed datetime object or None if parsing fails
        """
        if isinstance(dt_str, datetime):
            return dt_str
        
        if not dt_str:
            return None
        
        # Try ISO format first (Python 3.7+)
        try:
            return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            pass
        
        # Try SQLite datetime format
        try:
            return datetime.strptime(dt_str, '%Y-%m-%d %H:%M:%S')
        except (ValueError, AttributeError):
            pass
        
        # Try SQLite datetime with microseconds
        try:
            return datetime.strptime(dt_str, '%Y-%m-%d %H:%M:%S.%f')
        except (ValueError, AttributeError):
            pass
        
        logger.warning(f"Failed to parse datetime string: {dt_str}")
        return None
    
    def calculate_win_rate(self, trades: List[Dict[str, Any]], period: Optional[int] = None) -> float:
        """
        Calculate win rate over last N trades.
        
        Args:
            trades: List of trade dictionaries
            period: Number of trades to consider (None for all)
        
        Returns:
            Win rate percentage (0-100)
        """
        if not trades:
            return 0.0
        
        if period:
            trades = trades[:period]
        
        if not trades:
            return 0.0
        
        wins = sum(1 for t in trades if t.get('pnl', 0) > 0)
        total = len(trades)
        
        return (wins / total) * 100.0 if total > 0 else 0.0
    
    def calculate_daily_pnl(self, date: Optional[datetime] = None) -> float:
        """
        Calculate daily profit/loss.
        
        Args:
            date: Date to calculate for (default: today)
        
        Returns:
            Daily P&L
        """
        if date is None:
            date = datetime.now()
        
        session_perf = self.database.get_session_performance(date)
        return session_perf.get('total_pnl', 0.0)
    
    def calculate_average_hold_time(self, trades: List[Dict[str, Any]]) -> float:
        """
        Calculate average trade duration.
        
        Args:
            trades: List of trade dictionaries
        
        Returns:
            Average hold time in seconds
        """
        if not trades:
            return 0.0
        
        hold_times = [t.get('hold_time_seconds', 0) for t in trades if t.get('hold_time_seconds')]
        
        if not hold_times:
            return 0.0
        
        return sum(hold_times) / len(hold_times)
    
    def get_performance_metrics(self, period_days: int = 7) -> Dict[str, Any]:
        """
        Get all key performance metrics.
        
        Args:
            period_days: Number of days to analyze
        
        Returns:
            Dictionary with performance metrics
        """
        # Get recent trades
        trades = self.database.get_trade_history(limit=100)
        
        # Filter by period
        cutoff_date = datetime.now() - timedelta(days=period_days)
        recent_trades = []
        for t in trades:
            entry_time_str = t.get('entry_time')
            if entry_time_str:
                entry_time = self._parse_datetime(entry_time_str)
                if entry_time and entry_time >= cutoff_date:
                    recent_trades.append(t)
        
        # Calculate metrics
        win_rate = self.calculate_win_rate(recent_trades)
        total_pnl = sum(t.get('pnl', 0) for t in recent_trades)
        wins = sum(1 for t in recent_trades if t.get('pnl', 0) > 0)
        losses = sum(1 for t in recent_trades if t.get('pnl', 0) < 0)
        avg_hold_time = self.calculate_average_hold_time(recent_trades)
        
        # Calculate average win/loss
        winning_trades = [t for t in recent_trades if t.get('pnl', 0) > 0]
        losing_trades = [t for t in recent_trades if t.get('pnl', 0) < 0]
        
        avg_win = sum(t.get('pnl', 0) for t in winning_trades) / len(winning_trades) if winning_trades else 0.0
        avg_loss = sum(t.get('pnl', 0) for t in losing_trades) / len(losing_trades) if losing_trades else 0.0
        
        return {
            'period_days': period_days,
            'total_trades': len(recent_trades),
            'wins': wins,
            'losses': losses,
            'win_rate': win_rate,
            'total_pnl': total_pnl,
            'average_hold_time_seconds': avg_hold_time,
            'average_win': avg_win,
            'average_loss': avg_loss,
            'profit_factor': abs(avg_win / avg_loss) if avg_loss != 0 else 0.0
        }
    
    def generate_report(self, period_days: int = 7) -> str:
        """
        Create performance summary report.
        
        Args:
            period_days: Number of days to analyze
        
        Returns:
            Formatted report string
        """
        metrics = self.get_performance_metrics(period_days)
        
        report = f"""
=== Performance Report (Last {period_days} Days) ===
Total Trades: {metrics['total_trades']}
Wins: {metrics['wins']} | Losses: {metrics['losses']}
Win Rate: {metrics['win_rate']:.1f}%
Total P&L: ${metrics['total_pnl']:.2f}
Average Win: ${metrics['average_win']:.2f}
Average Loss: ${metrics['average_loss']:.2f}
Profit Factor: {metrics['profit_factor']:.2f}
Average Hold Time: {metrics['average_hold_time_seconds']:.1f}s
"""
        return report

