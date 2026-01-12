"""
Final order parameter validation before execution.
"""
from typing import Dict, Any
from ..utils.types import Signal
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class OrderValidator:
    """Validates order parameters before execution."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize order validator.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.execution_config = config.get('execution', {})
        self.slippage_tolerance = self.execution_config.get('slippage_tolerance_points', 2)
    
    def validate_order_parameters(self, signal: Signal, lot_size: float,
                                 stop_loss: float, take_profit: float,
                                 entry_price: float, symbol: str) -> Dict[str, Any]:
        """
        Validate order parameters before execution.
        
        Args:
            signal: Trading signal
            lot_size: Position size in lots
            stop_loss: Stop loss price
            take_profit: Take profit price
            entry_price: Entry price
            symbol: Trading symbol
        
        Returns:
            Dictionary with 'valid' and 'reason'
        """
        # Validate lot size
        min_lot = self.config.get('risk', {}).get('min_lot_size', 0.01)
        max_lot = self.config.get('risk', {}).get('max_lot_size', 0.30)
        
        if lot_size < min_lot:
            return {
                'valid': False,
                'reason': f'Lot size {lot_size} below minimum {min_lot}'
            }
        
        if lot_size > max_lot:
            return {
                'valid': False,
                'reason': f'Lot size {lot_size} above maximum {max_lot}'
            }
        
        # Validate stop loss
        if signal.direction == 'buy':
            if stop_loss >= entry_price:
                return {
                    'valid': False,
                    'reason': f'Stop loss {stop_loss} must be below entry {entry_price} for buy'
                }
        else:  # sell
            if stop_loss <= entry_price:
                return {
                    'valid': False,
                    'reason': f'Stop loss {stop_loss} must be above entry {entry_price} for sell'
                }
        
        # Validate take profit
        if signal.direction == 'buy':
            if take_profit <= entry_price:
                return {
                    'valid': False,
                    'reason': f'Take profit {take_profit} must be above entry {entry_price} for buy'
                }
        else:  # sell
            if take_profit >= entry_price:
                return {
                    'valid': False,
                    'reason': f'Take profit {take_profit} must be below entry {entry_price} for sell'
                }
        
        # Validate risk-reward ratio
        stop_distance = abs(entry_price - stop_loss)
        tp_distance = abs(take_profit - entry_price)
        
        if stop_distance == 0:
            return {
                'valid': False,
                'reason': 'Stop loss distance is zero'
            }
        
        risk_reward = tp_distance / stop_distance
        min_rr = self.config.get('risk', {}).get('risk_reward_ratio', {}).get('min', 1.0)
        
        if risk_reward < min_rr:
            return {
                'valid': False,
                'reason': f'Risk-reward ratio {risk_reward:.2f} below minimum {min_rr}'
            }
        
        return {
            'valid': True,
            'reason': 'All order parameters valid'
        }













