"""
Fetches historical market data from MT5 for backtesting.
"""
import MetaTrader5 as mt5  # type: ignore
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class HistoricalDataFetcher:
    """Fetches historical candles from MT5 for specified date ranges."""
    
    def __init__(self, mt5_connector):
        """
        Initialize historical data fetcher.
        
        Args:
            mt5_connector: MT5Connector instance (must be connected)
        """
        self.mt5_connector = mt5_connector
    
    def fetch_historical_candles(self, symbol: str, timeframe: int, 
                                start_date: datetime, end_date: datetime) -> List[Dict]:
        """
        Fetch historical candles for a date range.
        
        Args:
            symbol: Trading symbol (e.g., 'XAUUSD')
            timeframe: Timeframe in minutes (1, 5, 15, etc.)
            start_date: Start date (inclusive)
            end_date: End date (inclusive)
        
        Returns:
            List of candle dictionaries with keys: time, open, high, low, close, volume
        """
        if not self.mt5_connector.is_connected():
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
        
        if timeframe not in timeframe_map:
            logger.error(f"Unsupported timeframe: {timeframe}")
            return []
        
        mt5_timeframe = timeframe_map[timeframe]
        
        # Ensure dates are timezone-aware (UTC)
        from datetime import timezone
        if start_date.tzinfo is None:
            start_date = start_date.replace(tzinfo=timezone.utc)
            logger.info(f"Added UTC timezone to start_date: {start_date}")
        if end_date.tzinfo is None:
            end_date = end_date.replace(tzinfo=timezone.utc)
            logger.info(f"Added UTC timezone to end_date: {end_date}")
        
        # Adjust start_date to market open time (08:00 GMT) if it's at midnight
        # This helps with data availability
        if start_date.hour == 0 and start_date.minute == 0:
            start_date = start_date.replace(hour=8, minute=0)
            logger.info(f"Adjusted start date to market open time: {start_date}")
        
        # Adjust end_date to end of day if it's at midnight
        if end_date.hour == 0 and end_date.minute == 0:
            end_date = end_date.replace(hour=23, minute=59)
            logger.info(f"Adjusted end date to end of day: {end_date}")
        
        logger.info(f"Fetching {timeframe}M candles for {symbol} from {start_date} to {end_date}")
        logger.info(f"Start timestamp: {int(start_date.timestamp())}, End timestamp: {int(end_date.timestamp())}")
        
        # Fetch historical data using copy_rates_range
        # MT5's copy_rates_range accepts datetime objects directly
        rates = mt5.copy_rates_range(symbol, mt5_timeframe, start_date, end_date)
        
        if rates is None or len(rates) == 0:
            logger.warning(f"No historical candles retrieved for {symbol} on timeframe {timeframe}")
            # Check MT5 error
            error = mt5.last_error()
            if error:
                logger.warning(f"MT5 error: {error}")
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
        
        logger.info(f"Fetched {len(candles)} candles for {timeframe}M timeframe")
        return candles
    
    def generate_m1_from_m5(self, m5_candles: List[Dict]) -> List[Dict]:
        """
        Generate M1 candles from M5 candles by dividing each M5 candle into 5 M1 candles.
        This is a fallback when M1 historical data is not available.
        
        Args:
            m5_candles: List of M5 candle dictionaries
        
        Returns:
            List of M1 candle dictionaries
        """
        m1_candles = []
        
        for m5_candle in m5_candles:
            m5_time = m5_candle['time']
            m5_open = m5_candle['open']
            m5_high = m5_candle['high']
            m5_low = m5_candle['low']
            m5_close = m5_candle['close']
            m5_volume = m5_candle['volume']
            
            # Determine if M5 candle is bullish or bearish
            is_bullish = m5_close >= m5_open
            
            # Create 5 M1 candles with proper OHLC relationships
            for i in range(5):
                m1_time = m5_time + timedelta(minutes=i)
                
                # Calculate progress through the 5-minute period
                progress = i / 4.0 if i > 0 else 0.0  # 0.0 to 1.0
                
                # Interpolate price from open to close
                if is_bullish:
                    # Bullish: price generally moves up
                    m1_open = m5_open + (m5_close - m5_open) * progress
                    m1_close = m5_open + (m5_close - m5_open) * min(progress + 0.25, 1.0)
                else:
                    # Bearish: price generally moves down
                    m1_open = m5_open - (m5_open - m5_close) * progress
                    m1_close = m5_open - (m5_open - m5_close) * min(progress + 0.25, 1.0)
                
                # Ensure close doesn't exceed bounds
                m1_close = max(m5_low, min(m5_high, m1_close))
                m1_open = max(m5_low, min(m5_high, m1_open))
                
                # Set high and low based on candle direction
                if m1_close >= m1_open:
                    # Bullish M1 candle
                    m1_high = min(m5_high, m1_close + (m5_high - m5_low) * 0.1)  # Allow some wick
                    m1_low = max(m5_low, m1_open - (m5_high - m5_low) * 0.05)   # Small lower wick
                else:
                    # Bearish M1 candle
                    m1_high = min(m5_high, m1_open + (m5_high - m5_low) * 0.05)  # Small upper wick
                    m1_low = max(m5_low, m1_close - (m5_high - m5_low) * 0.1)   # Allow some wick
                
                # Ensure high >= low and high/low contain open/close
                m1_high = max(m1_high, m1_open, m1_close)
                m1_low = min(m1_low, m1_open, m1_close)
                
                # Final validation
                if m1_high < m1_low:
                    m1_high, m1_low = m1_low, m1_high
                
                m1_candles.append({
                    'time': m1_time,
                    'open': round(m1_open, 2),
                    'high': round(m1_high, 2),
                    'low': round(m1_low, 2),
                    'close': round(m1_close, 2),
                    'volume': max(1, m5_volume // 5)  # Distribute volume evenly, minimum 1
                })
        
        logger.info(f"Generated {len(m1_candles)} M1 candles from {len(m5_candles)} M5 candles")
        return m1_candles
    
    def validate_historical_data(self, candles: List[Dict]) -> Dict[str, Any]:
        """
        Validate historical data quality.
        
        Args:
            candles: List of candle dictionaries
        
        Returns:
            Dictionary with validation results
        """
        if not candles:
            return {
                'valid': False,
                'reason': 'No candles provided',
                'gaps': [],
                'total_candles': 0
            }
        
        gaps = []
        total_candles = len(candles)
        
        # Check for time gaps (assuming sequential candles)
        for i in range(1, len(candles)):
            prev_time = candles[i-1]['time']
            curr_time = candles[i]['time']
            
            # Calculate expected time difference based on timeframe
            # This is a simplified check - actual timeframe would need to be passed
            time_diff = (curr_time - prev_time).total_seconds()
            
            # Flag gaps larger than 5 minutes (for M1) or 30 minutes (for M5)
            if time_diff > 300:  # 5 minutes
                gaps.append({
                    'from': prev_time,
                    'to': curr_time,
                    'duration_seconds': time_diff
                })
        
        # Check for invalid OHLC data
        invalid_candles = []
        for i, candle in enumerate(candles):
            if candle['high'] < candle['low']:
                invalid_candles.append(i)
            if candle['high'] < candle['open'] or candle['high'] < candle['close']:
                invalid_candles.append(i)
            if candle['low'] > candle['open'] or candle['low'] > candle['close']:
                invalid_candles.append(i)
        
        return {
            'valid': len(invalid_candles) == 0 and len(gaps) < total_candles * 0.1,  # Allow up to 10% gaps
            'reason': 'Valid' if len(invalid_candles) == 0 else f'Invalid OHLC in {len(invalid_candles)} candles',
            'gaps': gaps,
            'invalid_candles': invalid_candles,
            'total_candles': total_candles,
            'gap_count': len(gaps)
        }
    
    def organize_candles_by_time(self, m1_candles: List[Dict], 
                                  m5_candles: List[Dict]) -> Dict[str, List[Dict]]:
        """
        Organize M1 and M5 candles for chronological replay.
        
        Args:
            m1_candles: List of M1 candles
            m5_candles: List of M5 candles
        
        Returns:
            Dictionary with organized candles
        """
        # Sort candles by time
        m1_sorted = sorted(m1_candles, key=lambda x: x['time'])
        m5_sorted = sorted(m5_candles, key=lambda x: x['time'])
        
        # Create time-indexed structure for efficient lookup
        m5_by_time = {candle['time']: candle for candle in m5_sorted}
        
        return {
            'm1_candles': m1_sorted,
            'm5_candles': m5_sorted,
            'm5_by_time': m5_by_time,
            'start_time': m1_sorted[0]['time'] if m1_sorted else None,
            'end_time': m1_sorted[-1]['time'] if m1_sorted else None
        }

