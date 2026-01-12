"""
Combines structure and momentum analysis to generate trading signals.
"""
from typing import Dict, List, Any, Optional
from datetime import datetime
from ..utils.types import Signal
from ..signals.structure_analyzer import StructureAnalyzer
from ..signals.momentum_analyzer import MomentumAnalyzer
from ..market_data.indicators import calculate_rsi
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class SignalGenerator:
    """Generates trading signals from market structure and momentum."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize signal generator.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.signal_config = config.get('signals', {})
        self.structure_analyzer = StructureAnalyzer(config)
        self.momentum_analyzer = MomentumAnalyzer(config)
        
        self.min_confidence = self.signal_config.get('min_confidence', 55)  # Lowered from 60 to 55 for scalping
        self.sell_confidence_penalty = self.signal_config.get('sell_confidence_penalty', 0)  # Penalty for sell signals
        self.rsi_oversold = self.signal_config.get('rsi_oversold', 30)
        self.rsi_overbought = self.signal_config.get('rsi_overbought', 70)
        self.rsi_extreme_low = self.signal_config.get('rsi_extreme_low', 25)
        self.rsi_extreme_high = self.signal_config.get('rsi_extreme_high', 75)
        self.min_body_ratio = self.signal_config.get('min_body_ratio', 0.35)
        self.strong_body_ratio = self.signal_config.get('strong_body_ratio', 0.70)
        
        # RSI Scalping Configuration
        rsi_config = self.signal_config.get('rsi_conditions', {})
        self.rsi_mode = rsi_config.get('mode', 'divergence_and_zone')
        
        # Buy conditions
        buy_config = rsi_config.get('buy_conditions', {})
        self.buy_m1_rsi_range = buy_config.get('m1_rsi_range', [25, 45])
        self.buy_m5_rsi_minimum = buy_config.get('m5_rsi_minimum', 45)
        self.buy_divergence_enabled = buy_config.get('OR_divergence_detected', {}).get('enabled', False)
        
        # Sell conditions
        sell_config = rsi_config.get('sell_conditions', {})
        self.sell_m1_rsi_range = sell_config.get('m1_rsi_range', [55, 75])
        self.sell_m5_rsi_maximum = sell_config.get('m5_rsi_maximum', 55)
        
        # Trend Alignment Configuration
        alignment_config = self.signal_config.get('trend_alignment', {})
        structure_validation = alignment_config.get('structure_validation', {})
        self.strict_mode = structure_validation.get('strict_mode', False)
        
        alignment_check = alignment_config.get('alignment_check', {})
        scoring = alignment_check.get('scoring', {})
        self.alignment_scores = {
            'both_bullish': scoring.get('both_bullish', 15),
            'both_bearish': scoring.get('both_bearish', 15),
            'm5_bullish_m1_neutral': scoring.get('m5_bullish_m1_neutral', 5),
            'm5_neutral_m1_bullish': scoring.get('m5_neutral_m1_bullish', 0),
            'm5_bearish_m1_neutral': scoring.get('m5_bearish_m1_neutral', 5),
            'm5_neutral_m1_bearish': scoring.get('m5_neutral_m1_bearish', 0),
            'conflicting': scoring.get('conflicting', 'REJECT')
        }
        
        neutral_rules = alignment_config.get('neutral_trend_rules', {})
        self.allow_neutral_trades = neutral_rules.get('allow_trades', True)
        self.neutral_require_stronger_momentum = neutral_rules.get('require_stronger_momentum', True)
        self.neutral_position_size_multiplier = neutral_rules.get('reduce_position_size', 0.7)
        self.neutral_stop_percent = neutral_rules.get('tighter_stop', 0.25)
        
        # Store confidence breakdown for detailed logging
        self._last_confidence_breakdown = {}
        self._last_final_confidence = 0.0
    
    def generate_signal(self, m5_data: Dict[str, Any], 
                       m1_data: Dict[str, Any], 
                       indicators: Dict[str, Any]) -> Optional[Signal]:
        """
        Main signal generation logic using Structure Break Momentum algorithm.
        
        Args:
            m5_data: Dictionary with 'candles', 'ema21', 'swing_points'
            m1_data: Dictionary with 'candles', 'rsi'
            indicators: Dictionary with calculated indicators
        
        Returns:
            Signal object or None if no valid signal
        """
        try:
            # Step 1: M5 Structure Analysis
            m5_candles = m5_data.get('candles', [])
            m5_ema21 = m5_data.get('ema21', [])
            m5_swing_points = m5_data.get('swing_points', {})
            
            structure = self.structure_analyzer.analyze_m5_structure(
                m5_candles, m5_ema21, m5_swing_points
            )
            
            # Step 2: M1 Momentum Confirmation
            m1_candles = m1_data.get('candles', [])
            m1_rsi_values = m1_data.get('rsi', [])
            
            momentum = self.momentum_analyzer.analyze_m1_momentum(m1_candles, m1_rsi_values)
            
            # Step 3: Trend Alignment Check
            alignment_result = self._check_trend_alignment(structure, momentum)
            if alignment_result['reject']:
                current_price = m5_candles[-1]['close'] if m5_candles else 0
                m5_trend = structure.get('trend', 'unknown')
                m1_direction = momentum.get('direction', 'none')
                
                logger.info("=" * 80)
                logger.info(f"❌ SIGNAL REJECTED: Trend alignment conflict")
                logger.info(f"   M5 Trend: {m5_trend} | M1 Direction: {m1_direction} | Price: ${current_price:.2f}")
                logger.info(f"   Reason: {alignment_result.get('reason', 'Unknown alignment issue')}")
                logger.info("=" * 80)
                return None
            
            # Step 4: Entry Condition Validation
            entry_validation = self._validate_entry_conditions(structure, momentum, m5_candles, 
                                                   m1_candles, m5_ema21, m1_rsi_values, 
                                                   m5_swing_points, alignment_result)
            if not entry_validation:
                # Enhanced logging to identify which condition failed
                m5_trend = structure.get('trend', 'unknown')
                m1_direction = momentum.get('direction', 'none')
                current_price = m5_candles[-1]['close'] if m5_candles else 0
                
                logger.info("=" * 80)
                logger.info(f"❌ SIGNAL REJECTED: Entry conditions not met")
                logger.info(f"   M5 Trend: {m5_trend} | M1 Direction: {m1_direction} | Price: ${current_price:.2f}")
                logger.info(f"   Alignment Reject: {alignment_result.get('reject', False)} | Reason: {alignment_result.get('reason', 'N/A')}")
                logger.info(f"   Momentum: Strength={momentum.get('strength', 0):.2f}, Body Ratio={momentum.get('body_ratio', 0):.2%}")
                logger.info("=" * 80)
                return None
            
            # Step 5: Determine entry type
            entry_type = self._determine_entry_type(structure, m5_candles, m5_swing_points)
            
            # Step 6: Calculate confidence score (includes alignment scoring)
            confidence = self._calculate_confidence(
                structure, momentum, m1_candles, m1_rsi_values, m5_candles, alignment_result, indicators
            )
            
            if confidence < self.min_confidence:
                m1_rsi_current = m1_rsi_values[-1] if m1_rsi_values else 0
                breakdown = self._last_confidence_breakdown
                atr_value = indicators.get('atr', 0) if indicators else 0
                
                logger.info("=" * 80)
                logger.info(f"❌ SIGNAL REJECTED: Confidence too low")
                logger.info(f"   Direction: {momentum.get('direction', 'none').upper()} | M5 Trend: {structure.get('trend', 'unknown')} | Price: ${m5_candles[-1]['close']:.2f}")
                logger.info(f"   Confidence: {confidence:.1f}% < Minimum: {self.min_confidence}% (Gap: {self.min_confidence - confidence:.1f}%)")
                logger.info(f"   Confidence Breakdown:")
                logger.info(f"      Base: {breakdown.get('base', 0):.1f}% | Alignment: {breakdown.get('alignment', 0):+.1f}% | Volume: {breakdown.get('volume', 0):+.1f}%")
                logger.info(f"      Momentum: {breakdown.get('momentum_strength', 0):+.1f}% | Wick: {breakdown.get('wick_ratio', 0):+.1f}% | Price Level: {breakdown.get('price_level', 0):+.1f}%")
                logger.info(f"      RSI: {breakdown.get('rsi', 0):+.1f}% (M1 RSI={m1_rsi_current:.1f}) | ATR: {breakdown.get('atr', 0):+.1f}% (ATR={atr_value:.2f})")
                if breakdown.get('sell_penalty', 0) != 0:
                    logger.info(f"      Sell Penalty: {breakdown.get('sell_penalty', 0):+.1f}%")
                logger.info("=" * 80)
                return None
            
            # Create signal
            current_price = m5_candles[-1]['close']
            direction = momentum['direction']
            
            reason = self._generate_reason(structure, momentum, entry_type, confidence, alignment_result)
            
            signal = Signal(
                direction=direction,
                entry_type=entry_type,
                confidence=confidence,
                timestamp=datetime.now(),
                reason=reason,
                price=current_price,
                alignment_result=alignment_result
            )
            
            # Enhanced signal logging with detailed breakdown
            m1_rsi_current = m1_rsi_values[-1] if m1_rsi_values else 0
            breakdown = self._last_confidence_breakdown
            atr_value = indicators.get('atr', 0) if indicators else 0
            atr_avg = indicators.get('atr_average', 0) if indicators else 0
            
            logger.info("=" * 80)
            logger.info(f"✅ SIGNAL GENERATED: {direction.upper()} {entry_type}")
            logger.info(f"   Price: ${current_price:.2f} | M5 Trend: {structure.get('trend', 'unknown')} | M1 Direction: {direction}")
            logger.info(f"   Confidence: {confidence:.1f}% (Min Required: {self.min_confidence}%)")
            logger.info(f"   Confidence Breakdown:")
            logger.info(f"      Base: {breakdown.get('base', 0):.1f}% | Alignment: {breakdown.get('alignment', 0):+.1f}% | Volume: {breakdown.get('volume', 0):+.1f}%")
            logger.info(f"      Momentum: {breakdown.get('momentum_strength', 0):+.1f}% | Wick: {breakdown.get('wick_ratio', 0):+.1f}% | Price Level: {breakdown.get('price_level', 0):+.1f}%")
            logger.info(f"      RSI: {breakdown.get('rsi', 0):+.1f}% (M1 RSI={m1_rsi_current:.1f}) | ATR: {breakdown.get('atr', 0):+.1f}% (ATR={atr_value:.2f}, Avg={atr_avg:.2f})")
            if breakdown.get('sell_penalty', 0) != 0:
                logger.info(f"      Sell Penalty: {breakdown.get('sell_penalty', 0):+.1f}%")
            logger.info(f"   Momentum: Strength={momentum.get('strength', 0):.2f}, Body Ratio={momentum.get('body_ratio', 0):.2%}, Wick Ratio={momentum.get('wick_ratio', 0):.2%}")
            logger.info(f"   Alignment: {alignment_result.get('alignment_type', 'unknown')} | Neutral Trend: {alignment_result.get('is_neutral_trend', False)}")
            logger.info("=" * 80)
            
            return signal
        
        except Exception as e:
            logger.error(f"Error generating signal: {e}", exc_info=True)
            return None
    
    def _check_trend_alignment(self, structure: Dict[str, Any], 
                               momentum: Dict[str, Any]) -> Dict[str, Any]:
        """
        Check trend alignment between M5 structure and M1 momentum.
        
        Returns:
            Dictionary with:
            {
                'reject': bool,
                'reason': str,
                'alignment_score': float,
                'is_neutral_trend': bool,
                'alignment_type': str
            }
        """
        m5_trend = structure.get('trend', 'neutral')
        m1_direction = momentum.get('direction', 'none')
        
        # Map momentum direction to trend classification
        if m1_direction == 'buy':
            m1_momentum = 'bullish'
        elif m1_direction == 'sell':
            m1_momentum = 'bearish'
        else:
            m1_momentum = 'neutral'
        
        # Check for conflicting signals (scoring-based instead of rejection)
        conflicting_score = self.alignment_scores.get('conflicting', 'REJECT')
        
        if m5_trend == 'bullish' and m1_momentum == 'bearish':
            # If conflicting is a number, use it as score. If "REJECT", reject the signal.
            if isinstance(conflicting_score, (int, float)):
                return {
                    'reject': False,
                    'reason': 'Conflicting: M5 bullish but M1 bearish (counter-trend)',
                    'alignment_score': conflicting_score,
                    'is_neutral_trend': False,
                    'alignment_type': 'conflicting'
                }
            else:
                return {
                    'reject': True,
                    'reason': 'Conflicting: M5 bullish but M1 bearish',
                    'alignment_score': 0,
                    'is_neutral_trend': False,
                    'alignment_type': 'conflicting'
                }
        
        if m5_trend == 'bearish' and m1_momentum == 'bullish':
            # If conflicting is a number, use it as score. If "REJECT", reject the signal.
            if isinstance(conflicting_score, (int, float)):
                return {
                    'reject': False,
                    'reason': 'Conflicting: M5 bearish but M1 bullish (counter-trend)',
                    'alignment_score': conflicting_score,
                    'is_neutral_trend': False,
                    'alignment_type': 'conflicting'
                }
            else:
                return {
                    'reject': True,
                    'reason': 'Conflicting: M5 bearish but M1 bullish',
                    'alignment_score': 0,
                    'is_neutral_trend': False,
                    'alignment_type': 'conflicting'
                }
        
        # Determine alignment type and score
        alignment_type = None
        alignment_score = 0
        is_neutral_trend = (m5_trend == 'neutral')
        
        if m5_trend == 'bullish' and m1_momentum == 'bullish':
            alignment_type = 'both_bullish'
            alignment_score = self.alignment_scores['both_bullish']
        elif m5_trend == 'bearish' and m1_momentum == 'bearish':
            alignment_type = 'both_bearish'
            alignment_score = self.alignment_scores['both_bearish']
        elif m5_trend == 'bullish' and m1_momentum == 'neutral':
            alignment_type = 'm5_bullish_m1_neutral'
            alignment_score = self.alignment_scores['m5_bullish_m1_neutral']
        elif m5_trend == 'neutral' and m1_momentum == 'bullish':
            alignment_type = 'm5_neutral_m1_bullish'
            alignment_score = self.alignment_scores['m5_neutral_m1_bullish']
        elif m5_trend == 'bearish' and m1_momentum == 'neutral':
            alignment_type = 'm5_bearish_m1_neutral'
            alignment_score = self.alignment_scores['m5_bearish_m1_neutral']
        elif m5_trend == 'neutral' and m1_momentum == 'bearish':
            alignment_type = 'm5_neutral_m1_bearish'
            alignment_score = self.alignment_scores['m5_neutral_m1_bearish']
        elif m5_trend == 'neutral' and m1_momentum == 'neutral':
            alignment_type = 'both_neutral'
            alignment_score = 0
        
        # Check if neutral trend is allowed
        if is_neutral_trend and not self.allow_neutral_trades:
            return {
                'reject': True,
                'reason': 'Neutral trend trades not allowed',
                'alignment_score': 0,
                'is_neutral_trend': True,
                'alignment_type': alignment_type
            }
        
        return {
            'reject': False,
            'reason': f'M5 {m5_trend} + M1 {m1_momentum}',
            'alignment_score': alignment_score,
            'is_neutral_trend': is_neutral_trend,
            'alignment_type': alignment_type
        }
    
    def _validate_entry_conditions(self, structure: Dict[str, Any], 
                                   momentum: Dict[str, Any],
                                   m5_candles: List[Dict[str, Any]],
                                   m1_candles: List[Dict[str, Any]],
                                   m5_ema21: List[float],
                                   m1_rsi: List[float],
                                   m5_swing_points: Dict[str, List[float]],
                                   alignment_result: Dict[str, Any]) -> bool:
        """
        SIMPLIFIED: Validate only 3 core conditions (hard gates):
        1. Directional bias (M5 trend) - no conflicting signals
        2. Momentum candle (M1) - has momentum direction
        3. One valid entry trigger - structure break/continuation
        
        All other filters (RSI, volume, wick, ATR) are now scoring-based, not rejection.
        
        Args:
            alignment_result: Result from _check_trend_alignment
        
        Returns:
            True if all 3 core conditions met
        """
        # CORE CONDITION 1: Momentum direction exists (M1 momentum candle)
        if momentum['direction'] == 'none':
            logger.info("Signal rejected - Entry condition 1 FAILED: No momentum direction detected")
            return False
        
        direction = momentum['direction']
        
        # CORE CONDITION 2: No conflicting directional bias (M5 trend alignment)
        # Only reject if M5 and M1 are directly conflicting
        if alignment_result.get('reject', False):
            logger.info(f"Signal rejected - Entry condition 2 FAILED: {alignment_result.get('reason', 'Trend conflict')}")
            return False
        
        # CORE CONDITION 3 (RELAXED FOR SCALPING): Entry triggers are now optional
        # For scalping, we prioritize momentum over specific entry patterns
        # Entry triggers will be used for confidence scoring instead of rejection
        current_price = m5_candles[-1]['close'] if m5_candles else 0
        swing_highs = m5_swing_points.get('swing_highs', [])
        swing_lows = m5_swing_points.get('swing_lows', [])
        
        # Check if EMA21 is available
        if not m5_ema21 or len(m5_ema21) == 0:
            current_ema = current_price
        else:
            current_ema = m5_ema21[-1]
        
        # SCALPING MODE: Entry triggers are optional
        # Having an entry trigger will boost confidence, but not having one won't reject the signal
        # This allows the bot to catch momentum moves without waiting for perfect setups
        entry_trigger_met = False
        
        if direction == 'buy':
            # Check for any valid entry trigger (optional)
            if swing_lows and self.structure_analyzer.is_price_near_level(
                current_price, min(swing_lows), candles=m5_candles
            ):
                entry_trigger_met = True
            elif self.structure_analyzer.is_pullback_to_ema(
                current_price, current_ema, m1_candles=m1_candles
            ):
                entry_trigger_met = True
            elif self.structure_analyzer.detect_liquidity_sweep(
                m5_candles, swing_lows, swing_highs=None
            ):
                entry_trigger_met = True
            elif self.structure_analyzer.detect_breakout_entry(
                m1_candles, swing_highs, swing_lows, 'buy'
            ):
                entry_trigger_met = True
        
        elif direction == 'sell':
            # Check for any valid entry trigger (optional)
            if swing_highs and self.structure_analyzer.is_price_near_level(
                current_price, max(swing_highs), candles=m5_candles
            ):
                entry_trigger_met = True
            elif self.structure_analyzer.is_pullback_to_ema(
                current_price, current_ema, m1_candles=m1_candles
            ):
                entry_trigger_met = True
            elif self.structure_analyzer.detect_liquidity_sweep(
                m5_candles, swing_lows=None, swing_highs=swing_highs
            ):
                entry_trigger_met = True
            elif self.structure_analyzer.detect_breakout_entry(
                m1_candles, swing_highs, swing_lows, 'sell'
            ):
                entry_trigger_met = True
        
        # SCALPING: Entry trigger is no longer required - just logged for confidence scoring
        if not entry_trigger_met:
            logger.debug(f"No specific entry trigger, but allowing signal for scalping (direction: {direction})")
        # Don't return False - allow signal to pass
        
        # All 3 core conditions met - signal passes hard gates
        # RSI, volume, wick, ATR are now scoring-based (handled in _calculate_confidence)
        logger.debug(f"Entry conditions PASSED: direction={direction}, alignment_ok=True, entry_trigger={'found' if entry_trigger_met else 'optional'}")
        return True
    
    def _determine_entry_type(self, structure: Dict[str, Any],
                             m5_candles: List[Dict[str, Any]],
                             swing_points: Dict[str, List[float]]) -> str:
        """
        Determine entry type classification.
        
        Returns:
            Entry type string
        """
        current_price = m5_candles[-1]['close']
        swing_highs = swing_points.get('swing_highs', [])
        swing_lows = swing_points.get('swing_lows', [])
        
        # Check for liquidity sweep first
        if self.structure_analyzer.detect_liquidity_sweep(m5_candles, swing_lows):
            return 'liquidity_sweep'
        
        # Check for structure break
        if swing_highs and current_price >= max(swing_highs) * 0.999:
            return 'structure_break'
        if swing_lows and current_price <= min(swing_lows) * 1.001:
            return 'structure_break'
        
        # Default to pullback continuation
        return 'pullback_continuation'
    
    def _calculate_confidence(self, structure: Dict[str, Any],
                            momentum: Dict[str, Any],
                            m1_candles: List[Dict[str, Any]],
                            m1_rsi: List[float],
                            m5_candles: List[Dict[str, Any]],
                            alignment_result: Dict[str, Any],
                            indicators: Optional[Dict[str, Any]] = None) -> float:
        """
        Calculate confidence score (0-100) using scoring system.
        
        All filters (RSI, volume, wick, ATR) are now scoring-based, not rejection.
        
        Args:
            alignment_result: Result from _check_trend_alignment
            indicators: Optional indicators dict with ATR values
        
        Returns:
            Confidence score
        """
        confidence = 60.0  # Base confidence for scalping (increased from 55 to 60 to help reach circuit breaker threshold)
        confidence_breakdown = {'base': 60.0}
        
        # Add alignment score
        alignment_score = alignment_result.get('alignment_score', 0)
        confidence += alignment_score
        confidence_breakdown['alignment'] = alignment_score
        
        # VOLUME SCORING (was binary, now scoring)
        volume_score = 0.0
        if self.momentum_analyzer.check_volume_spike(m1_candles):
            volume_score = 10.0  # Strong volume spike
        elif len(m1_candles) >= 5:
            # Check for moderate volume increase
            recent_volumes = [c.get('volume', 0) for c in m1_candles[-5:]]
            if recent_volumes and sum(recent_volumes) > 0:
                avg_volume = sum(recent_volumes[:-1]) / (len(recent_volumes) - 1)
                current_volume = recent_volumes[-1]
                if avg_volume > 0 and current_volume >= avg_volume * 1.2:
                    volume_score = 5.0  # Moderate volume increase
        confidence += volume_score
        confidence_breakdown['volume'] = volume_score
        
        # MOMENTUM STRENGTH SCORING
        momentum_score = 0.0
        if momentum['body_ratio'] >= self.strong_body_ratio:
            momentum_score = 10.0  # Strong momentum
        elif momentum['body_ratio'] >= self.min_body_ratio:
            momentum_score = 5.0  # Acceptable momentum
        confidence += momentum_score
        confidence_breakdown['momentum_strength'] = momentum_score
        
        # WICK RATIO SCORING (was rejection, now scoring)
        wick_ratio = momentum.get('wick_ratio', 0.5)  # Default to 50% if not available
        max_wick_ratio = self.signal_config.get('momentum_validation', {}).get('rejection_filter', {}).get('max_wick_ratio', 0.40)
        wick_score = 0.0
        if wick_ratio <= 0.20:
            wick_score = 5.0  # Clean candle (low wick)
        elif wick_ratio <= max_wick_ratio:
            wick_score = 0.0  # Acceptable wick
        else:
            wick_score = -10.0  # High wick (rejection wick) reduces confidence
        confidence += wick_score
        confidence_breakdown['wick_ratio'] = wick_score
        
        # PRICE LEVEL SCORING
        current_price = m5_candles[-1]['close'] if m5_candles else 0
        swing_highs = structure.get('resistance_level', 0)
        swing_lows = structure.get('support_level', 0)
        price_level_score = 0.0
        if abs(current_price - swing_highs) < 0.01 or abs(current_price - swing_lows) < 0.01:
            price_level_score = 10.0  # Exactly at key level
        confidence += price_level_score
        confidence_breakdown['price_level'] = price_level_score
        
        # RSI ZONE-BASED SCORING (already scoring-based)
        rsi_score = 0.0
        if m1_rsi:
            m1_rsi_current = m1_rsi[-1]
            direction = momentum.get('direction', 'none')
            
            if direction == 'buy':
                if m1_rsi_current < 30:
                    rsi_score = 10.0  # Extreme oversold
                elif 30 <= m1_rsi_current < 40:
                    rsi_score = 5.0  # Strong oversold
                elif 40 <= m1_rsi_current < 50:
                    rsi_score = 0.0  # Acceptable range
                elif 50 <= m1_rsi_current < 60:
                    rsi_score = -5.0  # Less ideal
                else:
                    rsi_score = -10.0  # Not ideal
            
            elif direction == 'sell':
                if m1_rsi_current > 70:
                    rsi_score = 10.0  # Extreme overbought
                elif 60 < m1_rsi_current <= 70:
                    rsi_score = 5.0  # Strong overbought
                elif 50 < m1_rsi_current <= 60:
                    rsi_score = 0.0  # Acceptable range
                elif 40 < m1_rsi_current <= 50:
                    rsi_score = -5.0  # Less ideal
                else:
                    rsi_score = -10.0  # Not ideal
        confidence += rsi_score
        confidence_breakdown['rsi'] = rsi_score
        
        # ATR SCORING (was rejection, now scoring)
        atr_score = 0.0
        if indicators:
            atr_value = indicators.get('atr', 0)
            atr_average = indicators.get('atr_average', 0)
            atr_config = self.config.get('atr', {})
            optimal_min = atr_config.get('optimal_min', 8.0)
            optimal_max = atr_config.get('optimal_max', 11.0)
            min_atr = atr_config.get('min_points', 6.0)
            max_atr = atr_config.get('max_points', 22.0)
            
            if optimal_min <= atr_value <= optimal_max:
                atr_score = 5.0  # Optimal ATR range
            elif min_atr <= atr_value < optimal_min or optimal_max < atr_value <= max_atr:
                atr_score = 0.0  # Acceptable but suboptimal
            # Don't penalize for ATR outside range (was rejection, now just no bonus)
            
            # Penalize ATR spikes
            if atr_average > 0 and atr_value > atr_average * 1.8:
                atr_score = -15.0  # ATR spike reduces confidence significantly
        confidence += atr_score
        confidence_breakdown['atr'] = atr_score
        
        # Apply sell signal penalty (requires higher confidence for sell signals)
        direction = momentum.get('direction', 'none')
        sell_penalty = 0.0
        if direction == 'sell' and self.sell_confidence_penalty != 0:
            sell_penalty = self.sell_confidence_penalty
            confidence += sell_penalty
        confidence_breakdown['sell_penalty'] = sell_penalty
        
        final_confidence = min(max(confidence, 0.0), 100.0)  # Clamp between 0 and 100
        
        # Store breakdown for logging
        self._last_confidence_breakdown = confidence_breakdown
        self._last_final_confidence = final_confidence
        
        return final_confidence
    
    def _generate_reason(self, structure: Dict[str, Any],
                        momentum: Dict[str, Any],
                        entry_type: str,
                        confidence: float,
                        alignment_result: Dict[str, Any]) -> str:
        """
        Generate human-readable reason for signal.
        
        Args:
            alignment_result: Result from _check_trend_alignment
        
        Returns:
            Reason string
        """
        direction = momentum['direction']
        trend = structure['trend']
        alignment_type = alignment_result.get('alignment_type', 'unknown')
        alignment_score = alignment_result.get('alignment_score', 0)
        is_neutral = alignment_result.get('is_neutral_trend', False)
        
        neutral_note = " [NEUTRAL]" if is_neutral else ""
        
        return (f"{direction.upper()} signal: {entry_type}{neutral_note} | "
                f"M5 {trend} trend | "
                f"M1 momentum strength {momentum['strength']:.2f} | "
                f"Alignment: {alignment_type} (+{alignment_score}%) | "
                f"Confidence {confidence:.1f}%")


