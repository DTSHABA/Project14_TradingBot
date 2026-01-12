"""
Multi-layered exit logic: TP, SL, time, momentum reversal, breakeven protection.
"""
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from ..utils.types import Position
from ..market_data.candle_processor import CandleProcessor
from ..market_data.indicators import calculate_rsi
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class ExitStrategy:
    """Implements multi-layered exit strategy."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize exit strategy.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.exit_config = config.get('exit', {})
        self.risk_config = config.get('risk', {})
        
        self.time_limit_minutes = self.exit_config.get('time_limit_minutes', 15)
        self.breakeven_profit_percent = self.exit_config.get('breakeven_profit_percent', 0.15)
        self.breakeven_buffer_points = self.exit_config.get('breakeven_buffer_points', 2)
        self.partial_exit_1_percent = self.exit_config.get('partial_exit_1_percent', 0.20)
        self.partial_exit_1_close_percent = self.exit_config.get('partial_exit_1_close_percent', 50)
        self.partial_exit_2_percent = self.exit_config.get('partial_exit_2_percent', 0.35)
        self.partial_exit_2_close_percent = self.exit_config.get('partial_exit_2_close_percent', 30)
        
        self.risk_reward_ratio = self.risk_config.get('risk_reward_ratio', {}).get('preferred', 1.2)
    
    def evaluate_exits(self, position: Position, market_data: Dict[str, Any],
                       indicators: Dict[str, Any], entry_time: datetime) -> Dict[str, Any]:
        """
        Multi-layered exit evaluation (first condition met = exit).
        
        Args:
            position: Open position
            market_data: Current market data with m1_candles
            indicators: Calculated indicators
            entry_time: Position entry time
        
        Returns:
            Dictionary with:
            {
                should_exit: bool,
                exit_type: str,
                action: str ('close', 'adjust_sl', 'partial_close'),
                exit_reason: str | None (only set when should_exit = true)
            }
        """
        current_time = datetime.now()
        hold_time = current_time - entry_time
        hold_time_minutes = hold_time.total_seconds() / 60
        
        current_price = market_data.get('current_price', position.price_open)
        m1_candles = market_data.get('m1_candles', [])
        
        # Calculate current profit percentage
        if position.type == 0:  # Buy position
            profit_price = current_price - position.price_open
            profit_percent = (profit_price / position.price_open) * 100
        else:  # Sell position
            profit_price = position.price_open - current_price
            profit_percent = (profit_price / position.price_open) * 100
        
        # 1. Take Profit Check
        stop_distance = abs(position.price_open - position.sl)
        tp_distance = stop_distance * self.risk_reward_ratio
        
        if position.type == 0:  # Buy
            tp_price = position.price_open + tp_distance
            if current_price >= tp_price:
                return {
                    'should_exit': True,
                    'exit_type': 'take_profit',
                    'action': 'close',
                    'exit_reason': 'take_profit'
                }
        else:  # Sell
            tp_price = position.price_open - tp_distance
            if current_price <= tp_price:
                return {
                    'should_exit': True,
                    'exit_type': 'take_profit',
                    'action': 'close',
                    'exit_reason': 'take_profit'
                }
        
        # 2. Time Limit Check
        if hold_time_minutes >= self.time_limit_minutes:
            return {
                'should_exit': True,
                'exit_type': 'time_limit',
                'action': 'close',
                'exit_reason': 'time_limit'
            }
        
        # 3. Stop Loss Check (handled by MT5, but we can check if price hit it)
        if position.type == 0:  # Buy
            if current_price <= position.sl:
                return {
                    'should_exit': True,
                    'exit_type': 'stop_loss',
                    'action': 'close',
                    'exit_reason': 'stop_loss'
                }
        else:  # Sell
            if current_price >= position.sl:
                return {
                    'should_exit': True,
                    'exit_type': 'stop_loss',
                    'action': 'close',
                    'exit_reason': 'stop_loss'
                }
        
        # 4. Momentum Reversal Check
        if len(m1_candles) >= 3:
            recent_candles = m1_candles[-3:]
            
            if position.type == 0:  # Buy position - check for bearish reversal
                if all(CandleProcessor.is_bearish(c) for c in recent_candles):
                    return {
                        'should_exit': True,
                        'exit_type': 'momentum_reversal',
                        'action': 'close',
                        'exit_reason': 'momentum_reversal'
                    }
            else:  # Sell position - check for bullish reversal
                if all(CandleProcessor.is_bullish(c) for c in recent_candles):
                    return {
                        'should_exit': True,
                        'exit_type': 'momentum_reversal',
                        'action': 'close',
                        'exit_reason': 'momentum_reversal'
                    }
        
        # 5. Breakeven Protection (adjust SL, don't exit)
        if profit_percent >= self.breakeven_profit_percent:
            if position.type == 0:  # Buy
                new_sl = position.price_open + (self.breakeven_buffer_points * 0.01)
                if position.sl < new_sl:
                    return {
                        'should_exit': False,
                        'exit_type': 'breakeven_protection',
                        'action': 'adjust_sl',
                        'exit_reason': None,
                        'new_sl': new_sl
                    }
            else:  # Sell
                new_sl = position.price_open - (self.breakeven_buffer_points * 0.01)
                if position.sl > new_sl:
                    return {
                        'should_exit': False,
                        'exit_type': 'breakeven_protection',
                        'action': 'adjust_sl',
                        'exit_reason': None,
                        'new_sl': new_sl
                    }
        
        # 6. Partial Exit Logic (check but don't exit fully)
        # This is handled separately in position_manager
        
        # No exit condition met
        return {
            'should_exit': False,
            'exit_type': 'none',
            'action': 'hold',
            'exit_reason': None
        }
    
    def check_partial_exit(self, position: Position, current_price: float,
                          entry_time: datetime, partial_closed: bool = False) -> Dict[str, Any]:
        """
        Check if partial exit conditions are met.
        
        Args:
            position: Open position
            current_price: Current market price
            entry_time: Position entry time
            partial_closed: Whether partial exit already executed
        
        Returns:
            Dictionary with partial exit recommendation
        """
        # Calculate profit percentage
        if position.type == 0:  # Buy
            profit_price = current_price - position.price_open
            profit_percent = (profit_price / position.price_open) * 100
        else:  # Sell
            profit_price = position.price_open - current_price
            profit_percent = (profit_price / position.price_open) * 100
        
        # First partial exit at 0.20% profit
        if profit_percent >= self.partial_exit_1_percent and not partial_closed:
            return {
                'should_partial_exit': True,
                'close_percent': self.partial_exit_1_close_percent,
                'move_sl_to_entry': True,
                'reason': 'partial_exit_1'
            }
        
        # Second partial exit at 0.35% profit (if first already done)
        if profit_percent >= self.partial_exit_2_percent and partial_closed:
            return {
                'should_partial_exit': True,
                'close_percent': self.partial_exit_2_close_percent,
                'move_sl_to_entry': False,
                'reason': 'partial_exit_2'
            }
        
        return {
            'should_partial_exit': False,
            'close_percent': 0,
            'move_sl_to_entry': False,
            'reason': None
        }













