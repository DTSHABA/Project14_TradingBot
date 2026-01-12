"""
M5 market structure identification and analysis.
"""
from typing import Dict, List, Any, Optional
from ..market_data.indicators import identify_swing_points, detect_trend
from ..market_data.candle_processor import CandleProcessor
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class StructureAnalyzer:
    """Analyzes M5 market structure for trading signals."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize structure analyzer.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.signal_config = config.get('signals', {})
        self.price_level_tolerance = self.signal_config.get('price_level_tolerance_points', 5)
        self.ema_pullback_tolerance = self.signal_config.get('ema_pullback_tolerance_points', 3)
        
        # Price Condition Scalping Configuration
        price_config = self.signal_config.get('price_conditions', {})
        
        # Swing level proximity
        swing_config = price_config.get('swing_level_proximity', {})
        self.swing_tolerance = swing_config.get('tolerance_points', 8)
        self.swing_lookback = swing_config.get('lookback_candles', 15)
        self.swing_min_bounces = swing_config.get('minimum_bounces', 1)
        
        # EMA pullback
        ema_config = price_config.get('ema_pullback', {})
        self.ema_tolerance = ema_config.get('tolerance_points', 6)
        self.ema_must_have_touched = ema_config.get('must_have_touched', True)
        
        # Liquidity sweep
        liquidity_config = price_config.get('liquidity_sweep', {})
        self.liquidity_sweep_enabled = liquidity_config.get('enabled', True)
        self.sweep_threshold = liquidity_config.get('sweep_threshold', 2)
        
        # Breakout entry
        breakout_config = price_config.get('breakout_entry', {})
        self.breakout_enabled = breakout_config.get('enabled', True)
    
    def analyze_m5_structure(self, candles: List[Dict[str, Any]], 
                            ema21: List[float], 
                            swing_points: Dict[str, List[float]]) -> Dict[str, Any]:
        """
        Identify market structure on M5 timeframe.
        
        Args:
            candles: M5 candle data
            ema21: EMA21 values
            swing_points: Dictionary with swing_highs and swing_lows
        
        Returns:
            Dictionary with structure analysis:
            {
                trend: 'bullish'|'bearish'|'neutral',
                support_level: float,
                resistance_level: float,
                structure_type: str
            }
        """
        if not candles or not ema21:
            return {
                'trend': 'neutral',
                'support_level': 0.0,
                'resistance_level': 0.0,
                'structure_type': 'none'
            }
        
        current_price = candles[-1]['close']
        current_ema = ema21[-1] if ema21 else current_price
        
        # Determine trend
        trend = detect_trend(ema21)
        
        # Get key levels
        swing_highs = swing_points.get('swing_highs', [])
        swing_lows = swing_points.get('swing_lows', [])
        
        # Identify support and resistance
        # Support: highest swing low (closest to current price from below)
        # Resistance: lowest swing high (closest to current price from above)
        support_level = max(swing_lows) if swing_lows else current_price * 0.999
        resistance_level = min(swing_highs) if swing_highs else current_price * 1.001
        
        # Determine structure type
        structure_type = 'none'
        if trend == 'bullish':
            if current_price > current_ema:
                structure_type = 'uptrend'
            elif self.is_pullback_to_ema(current_price, current_ema, self.ema_pullback_tolerance):
                structure_type = 'pullback'
        elif trend == 'bearish':
            if current_price < current_ema:
                structure_type = 'downtrend'
            elif self.is_pullback_to_ema(current_price, current_ema, self.ema_pullback_tolerance):
                structure_type = 'pullback'
        
        return {
            'trend': trend,
            'support_level': support_level,
            'resistance_level': resistance_level,
            'structure_type': structure_type,
            'current_price': current_price,
            'ema21': current_ema
        }
    
    def is_price_near_level(self, price: float, level: float, 
                           tolerance: Optional[float] = None,
                           candles: Optional[List[Dict[str, Any]]] = None) -> bool:
        """
        Check if price is near a key level (swing high/low) with validation.
        
        Args:
            price: Current price
            level: Key level to check
            tolerance: Tolerance in points (default: from config)
            candles: M5 candles for bounce validation (optional)
        
        Returns:
            True if price is within tolerance of level and level has minimum bounces
        """
        if tolerance is None:
            tolerance = self.swing_tolerance
        
        # Convert tolerance from points to price units
        # For XAUUSD, 1 point = 0.01, so tolerance points = tolerance * 0.01
        price_tolerance = tolerance * 0.01
        
        # Check if price is within tolerance
        if abs(price - level) > price_tolerance:
            return False
        
        # If candles provided, validate minimum bounces
        if candles and len(candles) >= self.swing_lookback:
            # Check last N candles for bounces at this level
            lookback_candles = candles[-self.swing_lookback:]
            bounce_count = 0
            
            for candle in lookback_candles:
                # Check if candle touched the level (high >= level >= low)
                if candle['low'] <= level <= candle['high']:
                    bounce_count += 1
            
            # Level must have been tested at least minimum_bounces times
            if bounce_count < self.swing_min_bounces:
                return False
        
        return True
    
    def is_pullback_to_ema(self, price: float, ema: float, 
                          tolerance: Optional[float] = None,
                          m1_candles: Optional[List[Dict[str, Any]]] = None) -> bool:
        """
        Detect pullback to EMA21 with touch validation.
        
        Args:
            price: Current price
            ema: EMA21 value
            tolerance: Tolerance in points (default: from config)
            m1_candles: M1 candles to check for EMA touch (optional)
        
        Returns:
            True if price is within tolerance of EMA and (if required) touched EMA recently
        """
        if tolerance is None:
            tolerance = self.ema_tolerance
        
        price_tolerance = tolerance * 0.01
        
        # Check if price is within tolerance
        if abs(price - ema) > price_tolerance:
            return False
        
        # If must_have_touched is enabled, check last 3 M1 candles
        if self.ema_must_have_touched and m1_candles and len(m1_candles) >= 3:
            recent_m1 = m1_candles[-3:]
            touched_ema = False
            
            for candle in recent_m1:
                # Check if candle touched EMA (low <= ema <= high)
                if candle['low'] <= ema <= candle['high']:
                    touched_ema = True
                    break
            
            if not touched_ema:
                return False
        
        return True
    
    def detect_liquidity_sweep(self, candles: List[Dict[str, Any]], 
                              swing_lows: List[float],
                              swing_highs: Optional[List[float]] = None) -> bool:
        """
        Detect liquidity sweep pattern (wick extends beyond swing level then recovery).
        
        Args:
            candles: Recent M5 candles
            swing_lows: List of swing low levels (for bullish sweep)
            swing_highs: List of swing high levels (for bearish sweep, optional)
        
        Returns:
            True if liquidity sweep detected
        """
        if not self.liquidity_sweep_enabled:
            return False
        
        if len(candles) < 3:
            return False
        
        # Convert sweep threshold to price units
        sweep_threshold_price = self.sweep_threshold * 0.01
        
        # Check for bullish sweep (wick below swing low)
        if swing_lows:
            min_swing_low = min(swing_lows)
            recent_candles = candles[-3:]
            
            for candle in recent_candles:
                # Wick extends sweep_threshold points below swing low
                sweep_level = min_swing_low - sweep_threshold_price
                if candle['low'] < sweep_level and candle['close'] > min_swing_low:
                    return True
        
        # Check for bearish sweep (wick above swing high)
        if swing_highs:
            max_swing_high = max(swing_highs)
            recent_candles = candles[-3:]
            
            for candle in recent_candles:
                # Wick extends sweep_threshold points above swing high
                sweep_level = max_swing_high + sweep_threshold_price
                if candle['high'] > sweep_level and candle['close'] < max_swing_high:
                    return True
        
        return False
    
    def detect_breakout_entry(self, m1_candles: List[Dict[str, Any]],
                             m5_swing_highs: List[float],
                             m5_swing_lows: List[float],
                             direction: str) -> bool:
        """
        Detect clean breakout entry (momentum continuation).
        
        Enhanced detection criteria:
        - Price breaks through M5 swing level with momentum
        - Breakout is sustained (not just a wick)
        - Current price confirms the breakout direction
        
        Args:
            m1_candles: Recent M1 candles (need at least 2)
            m5_swing_highs: M5 swing high levels
            m5_swing_lows: M5 swing low levels
            direction: 'buy' or 'sell'
        
        Returns:
            True if clean breakout detected
        """
        if not self.breakout_enabled:
            return False
        
        if len(m1_candles) < 2:
            return False
        
        if direction == 'buy' and m5_swing_highs:
            # Bullish breakout: M1 breaks above M5 swing high
            breakout_level = max(m5_swing_highs)
            prev_candle = m1_candles[-2]
            current_candle = m1_candles[-1]
            current_price = current_candle['close']
            
            # Check if breakout occurred (price broke through level)
            # Previous candle may have tested the level, current candle confirms breakout
            prev_tested_level = prev_candle['high'] >= breakout_level
            current_above_level = current_price > breakout_level
            
            # Enhanced: Check for momentum (strong body, not just wick)
            body_ratio = CandleProcessor.calculate_body_ratio(current_candle)
            is_bullish = CandleProcessor.is_bullish(current_candle)
            
            # Breakout confirmed if:
            # 1. Current price is above breakout level (sustained)
            # 2. Previous candle tested the level (resistance was there)
            # 3. Current candle is bullish with decent body (momentum, not just wick)
            if current_above_level and prev_tested_level and is_bullish and body_ratio >= 0.4:
                return True
            
            # Alternative: Previous candle closed above, current opens above (original logic)
            if prev_candle['close'] > breakout_level and current_candle['open'] > breakout_level:
                return True
        
        elif direction == 'sell' and m5_swing_lows:
            # Bearish breakout: M1 breaks below M5 swing low
            breakout_level = min(m5_swing_lows)
            prev_candle = m1_candles[-2]
            current_candle = m1_candles[-1]
            current_price = current_candle['close']
            
            # Check if breakout occurred (price broke through level)
            prev_tested_level = prev_candle['low'] <= breakout_level
            current_below_level = current_price < breakout_level
            
            # Enhanced: Check for momentum (strong body, not just wick)
            body_ratio = CandleProcessor.calculate_body_ratio(current_candle)
            is_bearish = CandleProcessor.is_bearish(current_candle)
            
            # Breakout confirmed if:
            # 1. Current price is below breakout level (sustained)
            # 2. Previous candle tested the level (support was there)
            # 3. Current candle is bearish with decent body (momentum, not just wick)
            if current_below_level and prev_tested_level and is_bearish and body_ratio >= 0.4:
                return True
            
            # Alternative: Previous candle closed below, current opens below (original logic)
            if prev_candle['close'] < breakout_level and current_candle['open'] < breakout_level:
                return True
        
        return False

