"""
M1 momentum confirmation analysis.
"""
import re
from typing import Dict, List, Any, Optional
from ..market_data.candle_processor import CandleProcessor
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class MomentumAnalyzer:
    """Analyzes M1 momentum for signal confirmation."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize momentum analyzer.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.signal_config = config.get('signals', {})
        
        # Legacy support - check for old config format
        momentum_validation = self.signal_config.get('momentum_validation', {})
        if momentum_validation and momentum_validation.get('method') == 'two_stage':
            # New two-stage configuration
            stage_1 = momentum_validation.get('stage_1_confirmation', {})
            stage_2 = momentum_validation.get('stage_2_strength', {})
            rejection = momentum_validation.get('rejection_filter', {})
            
            self.momentum_candles = stage_1.get('lookback', 2)
            self.min_body_ratio = stage_1.get('min_body_ratio', 0.55)
            self.stage_1_requirement = stage_1.get('requirement', '2 out of 2 same direction')
            self.weighted_threshold = stage_1.get('weighted_threshold', 0.5)  # Configurable threshold
            
            self.stage_2_size_multiplier = stage_2.get('current_candle_size', '>= 1.2x average of last 5')
            # Parse multiplier from string like ">= 0.95x average of last 5" or use numeric value
            if isinstance(self.stage_2_size_multiplier, str):
                match = re.search(r'([\d.]+)x', self.stage_2_size_multiplier)
                self.stage_2_size_multiplier = float(match.group(1)) if match else 1.2
            elif isinstance(self.stage_2_size_multiplier, (int, float)):
                self.stage_2_size_multiplier = float(self.stage_2_size_multiplier)
            else:
                self.stage_2_size_multiplier = 1.2
            
            # Stage 2 skip logic for strong Stage 1 momentum
            self.skip_stage2_if_strong = stage_2.get('skip_if_stage1_strong', False)
            self.stage1_strong_threshold = stage_2.get('stage1_strong_threshold', 0.7)
            
            self.volume_spike_multiplier = stage_2.get('OR_volume_spike', '>= 1.3x average')
            if isinstance(self.volume_spike_multiplier, str):
                match = re.search(r'([\d.]+)x', self.volume_spike_multiplier)
                self.volume_spike_multiplier = float(match.group(1)) if match else 1.3
            elif isinstance(self.volume_spike_multiplier, (int, float)):
                self.volume_spike_multiplier = float(self.volume_spike_multiplier)
            else:
                self.volume_spike_multiplier = 1.3
            
            self.max_wick_ratio = rejection.get('max_wick_ratio', 0.35)
            self.use_two_stage = True
        else:
            # Legacy configuration
            self.momentum_candles = self.signal_config.get('momentum_candles', 3)
            self.min_body_ratio = self.signal_config.get('min_body_ratio', 0.60)
            self.stage_2_size_multiplier = 1.2
            self.volume_spike_multiplier = 1.3
            self.max_wick_ratio = 0.35
            self.use_two_stage = False
        
        self.strong_body_ratio = self.signal_config.get('strong_body_ratio', 0.70)
    
    def analyze_m1_momentum(self, candles: List[Dict[str, Any]], 
                           rsi: List[float]) -> Dict[str, Any]:
        """
        Analyze M1 momentum using two-stage validation or legacy method.
        
        Args:
            candles: M1 candle data (last 10 candles)
            rsi: RSI values
        
        Returns:
            Dictionary with momentum analysis:
            {
                direction: 'buy'|'sell'|'none',
                strength: float,
                body_ratio: float
            }
        """
        if self.use_two_stage:
            return self._analyze_two_stage_momentum(candles, rsi)
        else:
            return self._analyze_legacy_momentum(candles, rsi)
    
    def _analyze_two_stage_momentum(self, candles: List[Dict[str, Any]], 
                                    rsi: List[float]) -> Dict[str, Any]:
        """
        Two-stage momentum validation for scalping.
        
        Stage 1: Quick momentum check - last 2 M1 candles, 2 out of 2 same direction
        Stage 2: Strength check - current candle >= 1.2x average OR volume spike >= 1.3x
        Rejection: Max wick ratio <= 0.35 (reject if wick > 35% of total range)
        """
        # Need at least 5 candles for stage 2 (average of last 5)
        if len(candles) < 5:
            wick_ratio = CandleProcessor.calculate_wick_ratio(candles[-1]) if candles else 0.5
            return {
                'direction': 'none',
                'strength': 0.0,
                'body_ratio': 0.0,
                'wick_ratio': wick_ratio
            }
        
        # Stage 1: Weighted scoring of last 2 candles (replaces all() check)
        stage_1_candles = candles[-self.momentum_candles:]
        if len(stage_1_candles) < self.momentum_candles:
            wick_ratio = CandleProcessor.calculate_wick_ratio(candles[-1]) if candles else 0.5
            return {
                'direction': 'none',
                'strength': 0.0,
                'body_ratio': 0.0,
                'wick_ratio': wick_ratio
            }
        
        # Weighted scoring: current candle 60%, previous candle 40%
        current_candle = stage_1_candles[-1]
        previous_candle = stage_1_candles[-2] if len(stage_1_candles) >= 2 else None
        
        current_weight = 0.6
        previous_weight = 0.4
        
        # Calculate weighted scores for bullish and bearish momentum
        bullish_score = 0.0
        bearish_score = 0.0
        
        # Current candle scoring (60% weight)
        current_is_bullish = CandleProcessor.is_bullish(current_candle)
        current_is_bearish = CandleProcessor.is_bearish(current_candle)
        current_body_ratio = CandleProcessor.calculate_body_ratio(current_candle)
        current_body_score = min(current_body_ratio / self.min_body_ratio, 1.0)  # Normalize to 0-1
        
        if current_is_bullish and current_body_ratio >= self.min_body_ratio:
            bullish_score += current_weight * current_body_score
        elif current_is_bearish and current_body_ratio >= self.min_body_ratio:
            bearish_score += current_weight * current_body_score
        
        # Previous candle scoring (40% weight)
        if previous_candle:
            prev_is_bullish = CandleProcessor.is_bullish(previous_candle)
            prev_is_bearish = CandleProcessor.is_bearish(previous_candle)
            prev_body_ratio = CandleProcessor.calculate_body_ratio(previous_candle)
            prev_body_score = min(prev_body_ratio / self.min_body_ratio, 1.0)  # Normalize to 0-1
            
            if prev_is_bullish and prev_body_ratio >= self.min_body_ratio:
                bullish_score += previous_weight * prev_body_score
            elif prev_is_bearish and prev_body_ratio >= self.min_body_ratio:
                bearish_score += previous_weight * prev_body_score
        
        # Log detailed info for debugging
        if previous_candle:
            logger.info(f"Momentum Stage 1 (Weighted): "
                       f"Current={'BULL' if current_is_bullish else 'BEAR' if current_is_bearish else 'NEUTRAL'} "
                       f"(ratio={current_body_ratio:.2%}, weight=60%), "
                       f"Previous={'BULL' if prev_is_bullish else 'BEAR' if prev_is_bearish else 'NEUTRAL'} "
                       f"(ratio={prev_body_ratio:.2%}, weight=40%), "
                       f"Bullish Score={bullish_score:.2f}, Bearish Score={bearish_score:.2f}")
        
        # Determine direction from weighted scores (threshold from config)
        # The score represents how well the candles match the momentum criteria
        direction = None
        momentum_threshold = self.weighted_threshold  # Use configurable threshold
        
        # Determine the winning score (max of bullish/bearish)
        winning_score = max(bullish_score, bearish_score)
        
        if bullish_score >= momentum_threshold and bullish_score > bearish_score:
            direction = 'buy'
        elif bearish_score >= momentum_threshold and bearish_score > bullish_score:
            direction = 'sell'
        
        if not direction:
            logger.info(f"Momentum Stage 1 FAILED: Weighted scores below threshold {momentum_threshold} "
                       f"(Bullish={bullish_score:.2f}, Bearish={bearish_score:.2f})")
            wick_ratio = CandleProcessor.calculate_wick_ratio(candles[-1])
            return {
                'direction': 'none',
                'strength': 0.0,
                'body_ratio': 0.0,
                'wick_ratio': wick_ratio
            }
        
        # Store winning score for Stage 2 skip logic
        stage1_winning_score = winning_score
        
        # Wick ratio is now scoring-based, not rejection
        # Store wick ratio for confidence scoring (no rejection)
        current_candle = candles[-1]
        wick_ratio = CandleProcessor.calculate_wick_ratio(current_candle)
        
        # Log wick ratio for scoring (but don't reject)
        if wick_ratio > self.max_wick_ratio:
            logger.debug(f"Momentum wick ratio {wick_ratio:.2%} > {self.max_wick_ratio:.2%} (will reduce confidence)")
        
        # Stage 2: Strength check (can be skipped if Stage 1 is very strong)
        # Check if we should skip Stage 2 due to strong Stage 1 momentum
        skip_stage2 = self.skip_stage2_if_strong and stage1_winning_score >= self.stage1_strong_threshold
        
        if skip_stage2:
            logger.info(f"Momentum Stage 2 SKIPPED: Stage 1 score {stage1_winning_score:.2f} >= "
                       f"{self.stage1_strong_threshold} (strong momentum, skipping Stage 2)")
            # Skip Stage 2, proceed directly to calculate strength and return
        else:
            # Get last 5 candles for average (excluding current)
            last_5_candles = candles[-6:-1] if len(candles) >= 6 else candles[:-1]
            
            if len(last_5_candles) < 5:
                # Not enough history, use available candles
                last_5_candles = candles[:-1] if len(candles) > 1 else []
            
            if len(last_5_candles) < 1:
                wick_ratio = CandleProcessor.calculate_wick_ratio(candles[-1]) if candles else 0.5
                return {
                    'direction': 'none',
                    'strength': 0.0,
                    'body_ratio': 0.0,
                    'wick_ratio': wick_ratio
                }
            
            # Calculate average body size of last 5 candles
            avg_body_size = sum(CandleProcessor.calculate_body_size(c) for c in last_5_candles) / len(last_5_candles)
            current_body_size = CandleProcessor.calculate_body_size(current_candle)
            
            # Check if current candle is >= multiplier x average
            # For XAUUSD scalping, we use the multiplier directly (0.95x = 95% of average)
            if self.stage_2_size_multiplier < 1.0:
                # If multiplier < 1.0, allow current to be slightly smaller than average
                size_check = current_body_size >= (avg_body_size * self.stage_2_size_multiplier)
            elif self.stage_2_size_multiplier <= 1.1:
                # If multiplier <= 1.1, allow 95% of average (more lenient)
                size_check = current_body_size >= (avg_body_size * 0.95)
            else:
                # If multiplier > 1.1, use exact multiplier
                size_check = current_body_size >= (avg_body_size * self.stage_2_size_multiplier)
            
            # Check volume spike (if available)
            volume_spike = self._check_volume_spike_stage2(candles)
            
            # Stage 2 passes if either condition is met
            stage_2_passed = size_check or volume_spike
            
            if not stage_2_passed:
                avg_body = avg_body_size if last_5_candles else 0
                current_body = current_body_size
                required_size = avg_body * self.stage_2_size_multiplier if avg_body > 0 else 0
                logger.info(f"Momentum Stage 2 FAILED: Current body size {current_body:.4f} < required "
                           f"{required_size:.4f} (avg={avg_body:.4f} * {self.stage_2_size_multiplier}x), "
                           f"volume_spike={volume_spike}")
                wick_ratio = CandleProcessor.calculate_wick_ratio(candles[-1]) if candles else 0.5
                return {
                    'direction': 'none',
                    'strength': 0.0,
                    'body_ratio': 0.0,
                    'wick_ratio': wick_ratio
                }
        
        # Calculate strength and body ratio
        body_ratios = [CandleProcessor.calculate_body_ratio(c) for c in stage_1_candles]
        avg_body_ratio = sum(body_ratios) / len(body_ratios)
        
        body_sizes = [CandleProcessor.calculate_body_size(c) for c in stage_1_candles]
        ranges = [CandleProcessor.calculate_range(c) for c in stage_1_candles]
        strength = sum(body_sizes) / sum(ranges) if sum(ranges) > 0 else 0.0
        
        # Store wick ratio for confidence scoring
        wick_ratio = CandleProcessor.calculate_wick_ratio(candles[-1])
        
        return {
            'direction': direction,
            'strength': strength,
            'body_ratio': avg_body_ratio,
            'wick_ratio': wick_ratio  # Added for scoring
        }
    
    def _check_volume_spike_stage2(self, candles: List[Dict[str, Any]]) -> bool:
        """
        Check for volume spike in stage 2 (>= multiplier x average).
        
        Args:
            candles: Recent candles
        
        Returns:
            True if volume spike detected
        """
        if len(candles) < 6:
            return False
        
        # Get last 5 volumes (excluding current)
        recent_volumes = [c.get('volume', 0) for c in candles[-6:-1]]
        current_volume = candles[-1].get('volume', 0)
        
        if not recent_volumes or sum(recent_volumes) == 0 or current_volume == 0:
            return False  # No volume data
        
        avg_volume = sum(recent_volumes) / len(recent_volumes)
        return current_volume >= (avg_volume * self.volume_spike_multiplier)
    
    def _analyze_legacy_momentum(self, candles: List[Dict[str, Any]], 
                                 rsi: List[float]) -> Dict[str, Any]:
        """
        Legacy momentum analysis (3 consecutive candles).
        
        Args:
            candles: M1 candle data (last 10 candles)
            rsi: RSI values
        
        Returns:
            Dictionary with momentum analysis
        """
        if len(candles) < self.momentum_candles:
            wick_ratio = CandleProcessor.calculate_wick_ratio(candles[-1]) if candles else 0.5
            return {
                'direction': 'none',
                'strength': 0.0,
                'body_ratio': 0.0,
                'wick_ratio': wick_ratio
            }
        
        # Check last N candles for consecutive direction
        recent_candles = candles[-self.momentum_candles:]
        
        # Check for buy momentum (3 consecutive bullish candles)
        buy_momentum = all(
            CandleProcessor.is_bullish(c) and 
            CandleProcessor.calculate_body_ratio(c) >= self.min_body_ratio
            for c in recent_candles
        )
        
        # Check for sell momentum (3 consecutive bearish candles)
        sell_momentum = all(
            CandleProcessor.is_bearish(c) and 
            CandleProcessor.calculate_body_ratio(c) >= self.min_body_ratio
            for c in recent_candles
        )
        
        if buy_momentum:
            # Calculate average body ratio for strength
            body_ratios = [CandleProcessor.calculate_body_ratio(c) for c in recent_candles]
            avg_body_ratio = sum(body_ratios) / len(body_ratios)
            
            # Calculate momentum strength (average body size relative to range)
            body_sizes = [CandleProcessor.calculate_body_size(c) for c in recent_candles]
            ranges = [CandleProcessor.calculate_range(c) for c in recent_candles]
            strength = sum(body_sizes) / sum(ranges) if sum(ranges) > 0 else 0.0
            
            # Store wick ratio for scoring
            wick_ratio = CandleProcessor.calculate_wick_ratio(candles[-1])
            
            return {
                'direction': 'buy',
                'strength': strength,
                'body_ratio': avg_body_ratio,
                'wick_ratio': wick_ratio
            }
        
        elif sell_momentum:
            body_ratios = [CandleProcessor.calculate_body_ratio(c) for c in recent_candles]
            avg_body_ratio = sum(body_ratios) / len(body_ratios)
            
            body_sizes = [CandleProcessor.calculate_body_size(c) for c in recent_candles]
            ranges = [CandleProcessor.calculate_range(c) for c in recent_candles]
            strength = sum(body_sizes) / sum(ranges) if sum(ranges) > 0 else 0.0
            
            # Store wick ratio for scoring
            wick_ratio = CandleProcessor.calculate_wick_ratio(candles[-1])
            
            return {
                'direction': 'sell',
                'strength': strength,
                'body_ratio': avg_body_ratio,
                'wick_ratio': wick_ratio
            }
        
        return {
            'direction': 'none',
            'strength': 0.0,
            'body_ratio': 0.0,
            'wick_ratio': 0.5  # Default
        }
    
    def has_strong_bodies(self, candles: List[Dict[str, Any]], 
                         min_body_ratio: Optional[float] = None) -> bool:
        """
        Validate candle body strength.
        
        Args:
            candles: Recent candles to check
            min_body_ratio: Minimum body ratio (default: from config)
        
        Returns:
            True if all candles have strong bodies
        """
        if min_body_ratio is None:
            min_body_ratio = self.min_body_ratio
        
        if not candles:
            return False
        
        return all(
            CandleProcessor.calculate_body_ratio(c) >= min_body_ratio
            for c in candles
        )
    
    def check_volume_spike(self, candles: List[Dict[str, Any]], 
                          lookback: int = 10) -> bool:
        """
        Optional volume confirmation (if available).
        
        Args:
            candles: Recent candles
            lookback: Number of candles to look back for average
        
        Returns:
            True if volume spike detected
        """
        if len(candles) < lookback + 1:
            return False
        
        recent_volumes = [c.get('volume', 0) for c in candles[-lookback:]]
        if not recent_volumes or sum(recent_volumes) == 0:
            return False  # No volume data
        
        avg_volume = sum(recent_volumes[:-1]) / (len(recent_volumes) - 1)
        current_volume = recent_volumes[-1]
        
        # Volume spike: current volume > 1.5x average
        return current_volume > avg_volume * 1.5

