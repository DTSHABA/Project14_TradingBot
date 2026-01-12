"""
Mock MT5 connector for backtesting that serves historical data.
"""
from typing import Dict, List, Optional
from datetime import datetime
from ..utils.types import AccountInfo
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class BacktestMT5Connector:
    """Mock MT5 connector that serves historical data for backtesting."""
    
    def __init__(self):
        """Initialize backtest connector."""
        self.connected = True  # Always "connected" in backtest mode
        self.m1_candles: List[Dict] = []
        self.m5_candles: List[Dict] = []
        self.current_time_index = 0
        self.symbol = 'XAUUSD'
        self.virtual_balance = 10000.0
        self.virtual_equity = 10000.0
        self.point = 0.01  # XAUUSD point value
        self.spread_points = 0.3  # Default spread in points
    
    def initialize_historical_data(self, m1_candles: List[Dict], m5_candles: List[Dict], 
                                  initial_equity: float = 10000.0) -> None:
        """
        Load historical data for backtesting.
        
        Args:
            m1_candles: List of M1 candles
            m5_candles: List of M5 candles
            initial_equity: Starting equity for backtest
        """
        self.m1_candles = sorted(m1_candles, key=lambda x: x['time'])
        self.m5_candles = sorted(m5_candles, key=lambda x: x['time'])
        self.current_time_index = 0
        self.virtual_balance = initial_equity
        self.virtual_equity = initial_equity
        
        logger.info(f"Initialized backtest with {len(self.m1_candles)} M1 candles and {len(self.m5_candles)} M5 candles")
    
    def is_connected(self) -> bool:
        """Check connection status (always True in backtest mode)."""
        return self.connected
    
    def get_candles(self, symbol: str, timeframe: int, count: int) -> List[Dict]:
        """
        Get historical candles up to current simulation time.
        
        Args:
            symbol: Trading symbol
            timeframe: Timeframe in minutes (1 or 5)
            count: Number of candles to return
        
        Returns:
            List of candle dictionaries
        """
        if not self.m1_candles or self.current_time_index >= len(self.m1_candles):
            return []
        
        current_time = self.m1_candles[self.current_time_index]['time']
        
        if timeframe == 1:
            # Return M1 candles up to current time
            available_candles = self.m1_candles[:self.current_time_index + 1]
            return available_candles[-count:] if len(available_candles) >= count else available_candles
        elif timeframe == 5:
            # Return M5 candles up to current time
            available_m5 = [c for c in self.m5_candles if c['time'] <= current_time]
            return available_m5[-count:] if len(available_m5) >= count else available_m5
        else:
            logger.warning(f"Unsupported timeframe for backtest: {timeframe}")
            return []
    
    def get_current_price(self, symbol: str) -> Optional[Dict[str, float]]:
        """
        Get current bid/ask price based on current candle.
        
        Args:
            symbol: Trading symbol
        
        Returns:
            Dictionary with 'bid', 'ask', 'spread', 'time'
        """
        if not self.m1_candles or self.current_time_index >= len(self.m1_candles):
            return None
        
        current_candle = self.m1_candles[self.current_time_index]
        
        # Use close price as midpoint, add/subtract half spread
        midpoint = current_candle['close']
        spread_amount = self.spread_points * self.point
        
        bid = midpoint - (spread_amount / 2)
        ask = midpoint + (spread_amount / 2)
        
        return {
            'bid': bid,
            'ask': ask,
            'spread': self.spread_points,
            'time': current_candle['time']
        }
    
    def get_account_info(self) -> Optional[AccountInfo]:
        """
        Get virtual account information.
        
        Returns:
            AccountInfo object
        """
        return AccountInfo(
            equity=self.virtual_equity,
            balance=self.virtual_balance,
            margin=0.0,  # Simplified for backtesting
            free_margin=self.virtual_equity,
            margin_level=0.0,
            currency="USD"
        )
    
    def get_open_positions(self, symbol: Optional[str] = None) -> List[Dict]:
        """
        Get open positions (delegated to backtest executor).
        
        This is a placeholder - actual positions are tracked by BacktestOrderExecutor.
        
        Args:
            symbol: Optional symbol filter
        
        Returns:
            Empty list (positions tracked elsewhere)
        """
        return []
    
    def advance_time(self) -> bool:
        """
        Advance simulation time by one M1 candle.
        
        Returns:
            True if time advanced, False if at end of data
        """
        if self.current_time_index < len(self.m1_candles) - 1:
            self.current_time_index += 1
            return True
        return False
    
    def get_current_time(self) -> Optional[datetime]:
        """
        Get current simulation time.
        
        Returns:
            Current datetime or None if no data
        """
        if self.m1_candles and self.current_time_index < len(self.m1_candles):
            return self.m1_candles[self.current_time_index]['time']
        return None
    
    def get_current_candle(self) -> Optional[Dict]:
        """
        Get current M1 candle.
        
        Returns:
            Current candle dictionary or None
        """
        if self.m1_candles and self.current_time_index < len(self.m1_candles):
            return self.m1_candles[self.current_time_index]
        return None
    
    def update_equity(self, new_equity: float) -> None:
        """
        Update virtual equity (called after trades).
        
        Args:
            new_equity: New equity value
        """
        self.virtual_equity = new_equity
        # Balance only increases, equity can decrease
        if new_equity > self.virtual_balance:
            self.virtual_balance = new_equity
    
    def reset_time(self) -> None:
        """Reset simulation time to start."""
        self.current_time_index = 0
        logger.info("Reset backtest time to start")

