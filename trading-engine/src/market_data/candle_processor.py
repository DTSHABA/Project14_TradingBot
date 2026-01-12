"""
OHLC data processing and validation.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class CandleProcessor:
    """Processes and validates OHLC candle data."""
    
    @staticmethod
    def validate_candles(candles: List[Dict[str, Any]], min_count: int = 1) -> bool:
        """
        Validate candle data integrity.
        
        Args:
            candles: List of candle dictionaries
            min_count: Minimum number of candles required
        
        Returns:
            True if valid, False otherwise
        """
        if not candles or len(candles) < min_count:
            logger.warning(f"Insufficient candles: {len(candles) if candles else 0} < {min_count}")
            return False
        
        for i, candle in enumerate(candles):
            # Check required fields
            required_fields = ['time', 'open', 'high', 'low', 'close']
            for field in required_fields:
                if field not in candle:
                    logger.warning(f"Candle {i} missing field: {field}")
                    return False
            
            # Validate price relationships
            if not (candle['low'] <= candle['open'] <= candle['high'] and
                    candle['low'] <= candle['close'] <= candle['high']):
                logger.warning(f"Candle {i} has invalid price relationships")
                return False
            
            # Check for zero or negative prices
            if any(price <= 0 for price in [candle['open'], candle['high'], 
                                           candle['low'], candle['close']]):
                logger.warning(f"Candle {i} has invalid prices")
                return False
        
        return True
    
    @staticmethod
    def clean_candles(candles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Clean and normalize candle data.
        
        Args:
            candles: List of raw candle dictionaries
        
        Returns:
            Cleaned candle list
        """
        cleaned = []
        for candle in candles:
            cleaned_candle = {
                'time': candle.get('time'),
                'open': float(candle.get('open', 0)),
                'high': float(candle.get('high', 0)),
                'low': float(candle.get('low', 0)),
                'close': float(candle.get('close', 0)),
                'volume': int(candle.get('volume', 0))
            }
            cleaned.append(cleaned_candle)
        
        return cleaned
    
    @staticmethod
    def get_price_data(candles: List[Dict[str, Any]]) -> Dict[str, List[float]]:
        """
        Extract price arrays from candles.
        
        Args:
            candles: List of candle dictionaries
        
        Returns:
            Dictionary with 'open', 'high', 'low', 'close' arrays
        """
        return {
            'open': [c['open'] for c in candles],
            'high': [c['high'] for c in candles],
            'low': [c['low'] for c in candles],
            'close': [c['close'] for c in candles]
        }
    
    @staticmethod
    def get_latest_candle(candles: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Get the most recent candle.
        
        Args:
            candles: List of candle dictionaries
        
        Returns:
            Latest candle or None if empty
        """
        if not candles:
            return None
        return candles[-1]
    
    @staticmethod
    def calculate_body_size(candle: Dict[str, Any]) -> float:
        """
        Calculate candle body size.
        
        Args:
            candle: Candle dictionary
        
        Returns:
            Absolute body size
        """
        return abs(candle['close'] - candle['open'])
    
    @staticmethod
    def calculate_range(candle: Dict[str, Any]) -> float:
        """
        Calculate candle range (high - low).
        
        Args:
            candle: Candle dictionary
        
        Returns:
            Candle range
        """
        return candle['high'] - candle['low']
    
    @staticmethod
    def calculate_body_ratio(candle: Dict[str, Any]) -> float:
        """
        Calculate body size as ratio of total range.
        
        Args:
            candle: Candle dictionary
        
        Returns:
            Body ratio (0-1)
        """
        range_size = CandleProcessor.calculate_range(candle)
        if range_size == 0:
            return 0.0
        return CandleProcessor.calculate_body_size(candle) / range_size
    
    @staticmethod
    def is_bullish(candle: Dict[str, Any]) -> bool:
        """
        Check if candle is bullish (green).
        
        Args:
            candle: Candle dictionary
        
        Returns:
            True if bullish
        """
        return candle['close'] > candle['open']
    
    @staticmethod
    def is_bearish(candle: Dict[str, Any]) -> bool:
        """
        Check if candle is bearish (red).
        
        Args:
            candle: Candle dictionary
        
        Returns:
            True if bearish
        """
        return candle['close'] < candle['open']
    
    @staticmethod
    def calculate_upper_wick(candle: Dict[str, Any]) -> float:
        """
        Calculate upper wick size (high - max(open, close)).
        
        Args:
            candle: Candle dictionary
        
        Returns:
            Upper wick size
        """
        return candle['high'] - max(candle['open'], candle['close'])
    
    @staticmethod
    def calculate_lower_wick(candle: Dict[str, Any]) -> float:
        """
        Calculate lower wick size (min(open, close) - low).
        
        Args:
            candle: Candle dictionary
        
        Returns:
            Lower wick size
        """
        return min(candle['open'], candle['close']) - candle['low']
    
    @staticmethod
    def calculate_max_wick(candle: Dict[str, Any]) -> float:
        """
        Calculate the maximum wick size (larger of upper or lower wick).
        
        Args:
            candle: Candle dictionary
        
        Returns:
            Maximum wick size
        """
        upper_wick = CandleProcessor.calculate_upper_wick(candle)
        lower_wick = CandleProcessor.calculate_lower_wick(candle)
        return max(upper_wick, lower_wick)
    
    @staticmethod
    def calculate_wick_ratio(candle: Dict[str, Any]) -> float:
        """
        Calculate maximum wick size as ratio of total range.
        
        Args:
            candle: Candle dictionary
        
        Returns:
            Wick ratio (0-1), where 1.0 means entire range is wick
        """
        range_size = CandleProcessor.calculate_range(candle)
        if range_size == 0:
            return 0.0
        max_wick = CandleProcessor.calculate_max_wick(candle)
        return max_wick / range_size


