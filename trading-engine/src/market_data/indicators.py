"""
Technical indicator calculations: EMA, RSI, ATR, swing points, trend detection.
"""
from typing import List, Dict, Any, Tuple, Optional
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


def calculate_ema(prices: List[float], period: int) -> List[float]:
    """
    Calculate Exponential Moving Average.
    
    Args:
        prices: List of price values
        period: EMA period
    
    Returns:
        List of EMA values
    """
    if len(prices) < period:
        logger.warning(f"Insufficient data for EMA{period}: {len(prices)} < {period}")
        return []
    
    ema_values = []
    multiplier = 2.0 / (period + 1)
    
    # Start with SMA
    sma = sum(prices[:period]) / period
    ema_values.append(sma)
    
    # Calculate EMA for remaining values
    for price in prices[period:]:
        ema = (price - ema_values[-1]) * multiplier + ema_values[-1]
        ema_values.append(ema)
    
    return ema_values


def calculate_rsi(prices: List[float], period: int = 14) -> List[float]:
    """
    Calculate Relative Strength Index.
    
    Args:
        prices: List of closing prices
        period: RSI period (default: 14)
    
    Returns:
        List of RSI values (0-100)
    """
    if len(prices) < period + 1:
        logger.warning(f"Insufficient data for RSI{period}: {len(prices)} < {period + 1}")
        return []
    
    rsi_values = []
    deltas = [prices[i] - prices[i-1] for i in range(1, len(prices))]
    
    for i in range(period, len(deltas) + 1):
        period_deltas = deltas[i-period:i]
        
        # Check for flat market (all deltas are zero)
        if all(d == 0 for d in period_deltas):
            rsi = 50  # Neutral RSI for flat market
            rsi_values.append(rsi)
            continue
        
        gains = [d for d in period_deltas if d > 0]
        losses = [-d for d in period_deltas if d < 0]
        
        avg_gain = sum(gains) / period if gains else 0
        avg_loss = sum(losses) / period if losses else 0
        
        if avg_loss == 0:
            rsi = 100
        else:
            rs = avg_gain / avg_loss
            rsi = 100 - (100 / (1 + rs))
        
        rsi_values.append(rsi)
    
    return rsi_values


def calculate_atr(high: List[float], low: List[float], close: List[float], period: int = 14) -> List[float]:
    """
    Calculate Average True Range.
    
    Args:
        high: List of high prices
        low: List of low prices
        close: List of closing prices
        period: ATR period (default: 14)
    
    Returns:
        List of ATR values
    """
    if len(high) < period + 1 or len(low) < period + 1 or len(close) < period + 1:
        logger.warning(f"Insufficient data for ATR{period}")
        return []
    
    true_ranges = []
    for i in range(1, len(high)):
        tr1 = high[i] - low[i]
        tr2 = abs(high[i] - close[i-1])
        tr3 = abs(low[i] - close[i-1])
        true_ranges.append(max(tr1, tr2, tr3))
    
    if len(true_ranges) < period:
        return []
    
    atr_values = []
    # Initial ATR is SMA of first period TRs
    atr = sum(true_ranges[:period]) / period
    atr_values.append(atr)
    
    # Calculate subsequent ATRs using Wilder's smoothing
    for i in range(period, len(true_ranges)):
        atr = (atr * (period - 1) + true_ranges[i]) / period
        atr_values.append(atr)
    
    return atr_values


def identify_swing_points(candles: List[Dict[str, Any]], lookback: int = 10) -> Dict[str, List[float]]:
    """
    Identify swing highs and lows on M5 timeframe.
    
    Args:
        candles: List of candle dictionaries (last N candles)
        lookback: Number of candles to look back for swing identification
    
    Returns:
        Dictionary with 'swing_highs' and 'swing_lows' lists
    """
    if len(candles) < lookback:
        logger.warning(f"Insufficient candles for swing points: {len(candles)} < {lookback}")
        return {'swing_highs': [], 'swing_lows': []}
    
    swing_highs = []
    swing_lows = []
    
    # Use last 'lookback' candles
    recent_candles = candles[-lookback:]
    
    for i in range(1, len(recent_candles) - 1):
        # Check for swing high (higher than neighbors)
        if (recent_candles[i]['high'] > recent_candles[i-1]['high'] and
            recent_candles[i]['high'] > recent_candles[i+1]['high']):
            swing_highs.append(recent_candles[i]['high'])
        
        # Check for swing low (lower than neighbors)
        if (recent_candles[i]['low'] < recent_candles[i-1]['low'] and
            recent_candles[i]['low'] < recent_candles[i+1]['low']):
            swing_lows.append(recent_candles[i]['low'])
    
    return {
        'swing_highs': swing_highs,
        'swing_lows': swing_lows
    }


def detect_trend(ema_values: List[float], lookback: int = 3) -> str:
    """
    Determine bullish/bearish trend from EMA21 slope.
    
    Args:
        ema_values: List of EMA values
        lookback: Number of recent EMA values to consider
    
    Returns:
        'bullish', 'bearish', or 'neutral'
    """
    if len(ema_values) < lookback:
        return 'neutral'
    
    recent_emas = ema_values[-lookback:]
    
    # Calculate slope
    if len(recent_emas) >= 2:
        slope = recent_emas[-1] - recent_emas[0]
        
        # Threshold: consider trend if slope is significant relative to EMA value
        threshold = recent_emas[-1] * 0.0001  # 0.01% of EMA value
        
        if slope > threshold:
            return 'bullish'
        elif slope < -threshold:
            return 'bearish'
    
    return 'neutral'


def calculate_atr_average(atr_values: List[float], period: int = 20) -> float:
    """
    Calculate average ATR over a period.
    
    Args:
        atr_values: List of ATR values
        period: Period for averaging
    
    Returns:
        Average ATR value
    """
    if len(atr_values) < period:
        return sum(atr_values) / len(atr_values) if atr_values else 0.0
    
    return sum(atr_values[-period:]) / period

