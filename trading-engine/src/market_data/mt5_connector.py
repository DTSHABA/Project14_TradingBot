"""
MetaTrader 5 API connection and data fetching.
"""
import MetaTrader5 as mt5  # type: ignore
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from ..utils.types import AccountInfo
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class MT5Connector:
    """Handles MT5 connection and data operations."""
    
    def __init__(self):
        """Initialize MT5 connector."""
        self.connected = False
        self.login = None
        self.password = None
        self.server = None
    
    def connect(self, login: int, password: str, server: str, path: str = None) -> bool:
        """
        Establish MT5 connection with credentials.
        
        Args:
            login: MT5 account number
            password: MT5 password
            server: MT5 broker server name
            path: Optional path to MT5 terminal executable
        
        Returns:
            True if connection successful, False otherwise
        """
        # Initialize MT5 with optional path
        # Try auto-detection first (recommended), then try with path if provided
        initialized = False
        
        # First, try auto-detection (no path) - this is the most reliable method
        if not path:
            initialized = mt5.initialize()
            if not initialized:
                logger.warning(f"MT5 auto-detection failed: {mt5.last_error()}")
        else:
            # Normalize path: convert forward slashes to backslashes for Windows
            normalized_path = path.replace('/', '\\')
            
            # Verify path exists
            from pathlib import Path
            if not Path(normalized_path).exists():
                logger.warning(f"MT5 path does not exist: {normalized_path}, trying auto-detection")
                initialized = mt5.initialize()  # Fallback to auto-detection
            else:
                # Try with provided path
                initialized = mt5.initialize(path=normalized_path)
                if not initialized:
                    logger.warning(f"MT5 initialization failed with path {normalized_path}: {mt5.last_error()}")
                    logger.info("Attempting auto-detection as fallback...")
                    initialized = mt5.initialize()  # Fallback to auto-detection
        
        if not initialized:
            error = mt5.last_error()
            logger.error(f"MT5 initialization failed: {error}")
            logger.error("Please ensure MetaTrader 5 terminal is installed and accessible")
            return False
        
        self.login = login
        self.password = password
        self.server = server
        
        authorized = mt5.login(login, password=password, server=server)
        if not authorized:
            logger.error(f"MT5 login failed: {mt5.last_error()}")
            mt5.shutdown()
            return False
        
        account_info = mt5.account_info()
        if account_info is None:
            logger.error("Failed to retrieve account info")
            mt5.shutdown()
            return False
        
        self.connected = True
        logger.info(f"Connected to MT5 account {login} on server {server}")
        logger.info(f"Balance: {account_info.balance}, Equity: {account_info.equity}")
        return True
    
    def disconnect(self) -> None:
        """Close MT5 connection."""
        if self.connected:
            mt5.shutdown()
            self.connected = False
            logger.info("Disconnected from MT5")
    
    def is_connected(self) -> bool:
        """
        Check connection status.
        
        Returns:
            True if connected, False otherwise
        """
        return self.connected and mt5.terminal_info() is not None
    
    def get_candles(self, symbol: str, timeframe: int, count: int) -> List[Dict]:
        """
        Fetch OHLC candle data.
        
        Args:
            symbol: Trading symbol (e.g., 'XAUUSD')
            timeframe: Timeframe in minutes (1, 5, 15, etc.) or MT5 constant
            count: Number of candles to fetch
        
        Returns:
            List of candle dictionaries with keys: time, open, high, low, close, volume
        """
        if not self.is_connected():
            logger.error("MT5 not connected")
            return []
        
        # Map integer timeframes to MT5 constants
        timeframe_map = {
            1: mt5.TIMEFRAME_M1,
            5: mt5.TIMEFRAME_M5,
            15: mt5.TIMEFRAME_M15,
            30: mt5.TIMEFRAME_M30,
            60: mt5.TIMEFRAME_H1,
            240: mt5.TIMEFRAME_H4,
            1440: mt5.TIMEFRAME_D1,
        }
        
        # Use MT5 constant if provided, otherwise map from integer
        if isinstance(timeframe, int) and timeframe in timeframe_map:
            mt5_timeframe = timeframe_map[timeframe]
        elif hasattr(mt5, 'TIMEFRAME_M1') and isinstance(timeframe, int):
            # Fallback: assume it's already an MT5 constant
            mt5_timeframe = timeframe
        else:
            mt5_timeframe = timeframe
        
        rates = mt5.copy_rates_from_pos(symbol, mt5_timeframe, 0, count)
        if rates is None or len(rates) == 0:
            logger.warning(f"No candles retrieved for {symbol} on timeframe {timeframe}")
            return []
        
        candles = []
        for rate in rates:
            candles.append({
                'time': datetime.fromtimestamp(rate[0]),
                'open': float(rate[1]),
                'high': float(rate[2]),
                'low': float(rate[3]),
                'close': float(rate[4]),
                'volume': int(rate[5])
            })
        
        return candles
    
    def get_current_price(self, symbol: str) -> Optional[Dict[str, float]]:
        """
        Get current bid/ask price and spread.
        
        Args:
            symbol: Trading symbol
        
        Returns:
            Dictionary with 'bid', 'ask', 'spread' (in points), or None if error
        """
        if not self.is_connected():
            logger.error("MT5 not connected")
            return None
        
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            logger.error(f"Failed to get tick for {symbol}: {mt5.last_error()}")
            return None
        
        symbol_info = mt5.symbol_info(symbol)
        if symbol_info is None:
            logger.error(f"Failed to get symbol info for {symbol}")
            return None
        
        # Calculate spread in points
        point = symbol_info.point
        spread_points = (tick.ask - tick.bid) / point
        
        return {
            'bid': float(tick.bid),
            'ask': float(tick.ask),
            'spread': spread_points,
            'time': datetime.fromtimestamp(tick.time)
        }
    
    def get_account_info(self) -> Optional[AccountInfo]:
        """
        Retrieve account information.
        
        Returns:
            AccountInfo object or None if error
        """
        if not self.is_connected():
            logger.error("MT5 not connected")
            return None
        
        account_info = mt5.account_info()
        if account_info is None:
            logger.error(f"Failed to get account info: {mt5.last_error()}")
            return None
        
        return AccountInfo(
            equity=float(account_info.equity),
            balance=float(account_info.balance),
            margin=float(account_info.margin),
            free_margin=float(account_info.margin_free),
            margin_level=float(account_info.margin_level) if account_info.margin_level else 0.0,
            currency=account_info.currency
        )
    
    def get_open_positions(self, symbol: Optional[str] = None) -> List[Dict]:
        """
        Get open positions.
        
        Args:
            symbol: Optional symbol filter
        
        Returns:
            List of position dictionaries
        """
        if not self.is_connected():
            logger.error("MT5 not connected")
            return []
        
        positions = mt5.positions_get(symbol=symbol) if symbol else mt5.positions_get()
        if positions is None:
            if mt5.last_error()[0] == mt5.RES_S_OK:  # No positions
                return []
            logger.error(f"Failed to get positions: {mt5.last_error()}")
            return []
        
        result = []
        for pos in positions:
            result.append({
                'ticket': pos.ticket,
                'symbol': pos.symbol,
                'type': pos.type,  # 0=buy, 1=sell
                'volume': float(pos.volume),
                'price_open': float(pos.price_open),
                'sl': float(pos.sl),
                'tp': float(pos.tp),
                'profit': float(pos.profit),
                'time': datetime.fromtimestamp(pos.time),
                'time_update': datetime.fromtimestamp(pos.time_update)
            })
        
        return result

