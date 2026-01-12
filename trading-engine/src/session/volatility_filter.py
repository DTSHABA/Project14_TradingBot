"""
ATR-based market condition filtering and volatility validation.
"""
from typing import Dict, Any
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class VolatilityFilter:
    """Filters trades based on ATR volatility conditions."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize volatility filter.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.atr_config = config.get('atr', {})
        
        self.min_atr = self.atr_config.get('min_points', 6.0)
        self.max_atr = self.atr_config.get('max_points', 12.0)
        self.optimal_min = self.atr_config.get('optimal_min', 8.0)
        self.optimal_max = self.atr_config.get('optimal_max', 11.0)
        self.spike_multiplier = self.atr_config.get('spike_multiplier', 1.8)
        self.average_period = self.atr_config.get('average_period', 20)
    
    def validate_atr(self, atr_value: float, atr_average: float) -> Dict[str, Any]:
        """
        ATR filtering and validation.
        
        Args:
            atr_value: Current ATR value
            atr_average: Average ATR over period
        
        Returns:
            Dictionary with 'valid', 'reason', 'confidence_adjustment'
        """
        # Minimum check: reject if too choppy
        if atr_value < self.min_atr:
            return {
                'valid': False,
                'reason': f'ATR {atr_value:.2f} below minimum {self.min_atr:.2f} (market too choppy)',
                'confidence_adjustment': 0
            }
        
        # Maximum check: reject if too volatile
        if atr_value > self.max_atr:
            return {
                'valid': False,
                'reason': f'ATR {atr_value:.2f} above maximum {self.max_atr:.2f} (too volatile)',
                'confidence_adjustment': 0
            }
        
        # Spike detection
        if atr_average > 0 and atr_value > atr_average * self.spike_multiplier:
            return {
                'valid': False,
                'reason': f'ATR spike detected: {atr_value:.2f} > {atr_average * self.spike_multiplier:.2f}',
                'confidence_adjustment': 0
            }
        
        # Optimal range: full confidence
        if self.optimal_min <= atr_value <= self.optimal_max:
            return {
                'valid': True,
                'reason': f'ATR {atr_value:.2f} in optimal range',
                'confidence_adjustment': 0
            }
        
        # Suboptimal but acceptable: reduce confidence by 10%
        if (self.min_atr <= atr_value < self.optimal_min) or (self.optimal_max < atr_value <= self.max_atr):
            return {
                'valid': True,
                'reason': f'ATR {atr_value:.2f} in acceptable but suboptimal range',
                'confidence_adjustment': -10
            }
        
        return {
            'valid': True,
            'reason': f'ATR {atr_value:.2f} validated',
            'confidence_adjustment': 0
        }
    
    def is_market_choppy(self, atr: float, atr_average: float) -> bool:
        """
        Determine if market is too choppy for trading.
        
        Args:
            atr: Current ATR
            atr_average: Average ATR
        
        Returns:
            True if market is too choppy
        """
        return atr < self.min_atr
    
    def is_market_too_volatile(self, atr: float) -> bool:
        """
        Check if volatility too high for tight stops.
        
        Args:
            atr: Current ATR
        
        Returns:
            True if too volatile
        """
        return atr > self.max_atr













