"""
Pre-trade risk validation: spread, ATR, equity checks.
"""
from typing import Dict, Any, Optional
from ..utils.types import Signal, AccountInfo
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class RiskValidator:
    """Validates signals before trade execution."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize risk validator.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.spread_config = config.get('spread', {})
        self.atr_config = config.get('atr', {})
        self.execution_config = config.get('execution', {})
        self.max_positions = self.execution_config.get('max_concurrent_positions', 1)
    
    def validate_signal(self, signal: Signal, market_data: Dict[str, Any],
                        account_info: AccountInfo, config: Dict[str, Any],
                        session_type: str = 'prime') -> Dict[str, Any]:
        """
        Pre-trade validation checks.
        
        Args:
            signal: Trading signal
            market_data: Market data dictionary with spread, ATR, etc.
            account_info: Account information
            config: Full configuration
            session_type: Session type ('prime' or 'acceptable')
        
        Returns:
            Dictionary with 'valid' (bool) and 'reason' (str)
        """
        # Check spread
        spread = market_data.get('spread', 0)
        spread_check = self.check_spread(spread, session_type)
        if not spread_check['valid']:
            return spread_check
        
        # ATR is now scoring-based (handled in signal generator confidence calculation)
        # Only check for extreme spikes that indicate news events (reject those)
        atr_value = market_data.get('atr', 0)
        atr_average = market_data.get('atr_average', 0)
        spike_multiplier = self.atr_config.get('spike_multiplier', 1.8)
        
        # Only reject extreme ATR spikes (2.5x+ = likely news event)
        if atr_average > 0 and atr_value > atr_average * 2.5:
            return {
                'valid': False,
                'reason': f'Extreme ATR spike: {atr_value:.2f} > {atr_average * 2.5:.2f} (likely news event)'
            }
        
        # Check equity (will be checked again with actual margin requirement)
        # This is a preliminary check
        if account_info.equity <= 0:
            return {
                'valid': False,
                'reason': 'Invalid equity'
            }
        
        # Check for existing positions (if max_concurrent_positions = 1)
        existing_positions = market_data.get('open_positions', [])
        if len(existing_positions) >= self.max_positions:
            return {
                'valid': False,
                'reason': f'Maximum positions ({self.max_positions}) already open'
            }
        
        return {
            'valid': True,
            'reason': 'All validation checks passed'
        }
    
    def check_spread(self, spread: float, session_type: str = 'prime') -> Dict[str, Any]:
        """
        Validate spread within limits.
        
        Args:
            spread: Current spread in points
            session_type: Session type ('prime' or 'acceptable')
        
        Returns:
            Dictionary with 'valid' and 'reason'
        """
        if session_type == 'prime':
            max_spread = self.spread_config.get('prime_max', 25.0)
        elif session_type == 'acceptable':
            max_spread = self.spread_config.get('acceptable_max', 35.0)
        else:
            max_spread = self.spread_config.get('default_max', 30.0)
        
        logger.info(f"Spread check: {spread:.2f} points vs limit {max_spread:.2f} ({session_type} session)")
        
        if spread > max_spread:
            return {
                'valid': False,
                'reason': f'Spread {spread:.2f} exceeds limit {max_spread:.2f} for {session_type} session'
            }
        
        logger.info(f"✓ Spread validation passed: {spread:.2f} <= {max_spread:.2f}")
        return {
            'valid': True,
            'reason': f'Spread {spread:.2f} within limits'
        }
    
    def check_atr(self, atr_value: float, atr_average: float) -> Dict[str, Any]:
        """
        Validate ATR in range and check for spikes.
        
        Args:
            atr_value: Current ATR value
            atr_average: Average ATR over period
        
        Returns:
            Dictionary with 'valid' and 'reason'
        """
        min_atr = self.atr_config.get('min_points', 6.0)
        max_atr = self.atr_config.get('max_points', 12.0)
        spike_multiplier = self.atr_config.get('spike_multiplier', 1.8)
        
        if atr_value < min_atr:
            return {
                'valid': False,
                'reason': f'ATR {atr_value:.2f} below minimum {min_atr:.2f} (market too choppy)'
            }
        
        if atr_value > max_atr:
            return {
                'valid': False,
                'reason': f'ATR {atr_value:.2f} above maximum {max_atr:.2f} (too volatile)'
            }
        
        # Check for ATR spike
        if atr_average > 0 and atr_value > atr_average * spike_multiplier:
            return {
                'valid': False,
                'reason': f'ATR spike detected: {atr_value:.2f} > {atr_average * spike_multiplier:.2f} (likely news event)'
            }
        
        return {
            'valid': True,
            'reason': f'ATR {atr_value:.2f} within acceptable range'
        }
    
    def check_equity(self, equity: float, required_margin: float) -> Dict[str, Any]:
        """
        Ensure sufficient equity for trade.
        
        Args:
            equity: Account equity
            required_margin: Required margin for the trade
        
        Returns:
            Dictionary with 'valid' and 'reason'
        """
        if equity < required_margin * 1.1:  # 10% buffer
            return {
                'valid': False,
                'reason': f'Insufficient equity: {equity:.2f} < {required_margin * 1.1:.2f}'
            }
        
        return {
            'valid': True,
            'reason': 'Sufficient equity available'
        }


