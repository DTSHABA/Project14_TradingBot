"""
Multi-criteria circuit breaker system with graduated response.
"""
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from ..utils.types import CircuitBreakerState
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class CircuitBreaker:
    """Implements circuit breaker logic to halt trading under adverse conditions."""
    
    def __init__(self, config: Dict[str, Any], database):
        """
        Initialize circuit breaker.
        
        Args:
            config: Configuration dictionary
            database: Database instance for trade history
        """
        self.config = config
        self.cb_config = config.get('circuit_breaker', {})
        self.database = database
        
        self.consecutive_losses_threshold = self.cb_config.get('consecutive_losses', 3)
        self.losses_in_window = self.cb_config.get('losses_in_window', 5)
        self.window_size = self.cb_config.get('window_size', 7)
        self.daily_drawdown_percent = self.cb_config.get('daily_drawdown_percent', 3.0)
        self.stopouts_in_window = self.cb_config.get('stopouts_in_window', 4)
        self.stopout_window_size = self.cb_config.get('stopout_window_size', 5)
        self.halt_duration_minutes = self.cb_config.get('halt_duration_minutes', 60)
        
        self.graduated_response = self.cb_config.get('graduated_response', {})
        
        # Current state
        self.halted = False
        self.halt_reason = None
        self.halt_start_time = None
        self.loss_count = 0
        self.adjusted_risk_percent = config.get('risk', {}).get('risk_per_trade', 0.5)
        self.adjusted_confidence_threshold = config.get('signals', {}).get('min_confidence', 60)
    
    def check_halts(self, trade_history: List[Dict[str, Any]], 
                   daily_pnl: float, starting_equity: float) -> Dict[str, Any]:
        """
        Evaluate halt conditions.
        
        Args:
            trade_history: List of recent trades
            daily_pnl: Daily profit/loss
            starting_equity: Starting equity for the day
        
        Returns:
            Dictionary with 'halted', 'reason', 'duration_minutes'
        """
        # Check if already halted and if halt period has expired
        if self.halted and self.halt_start_time:
            elapsed = (datetime.now() - self.halt_start_time).total_seconds() / 60
            if elapsed >= self.halt_duration_minutes:
                # Halt period expired, check reset conditions
                if self._check_reset_conditions(trade_history):
                    self._reset()
                    return {
                        'halted': False,
                        'reason': 'Halt period expired and reset conditions met',
                        'duration_minutes': 0
                    }
                else:
                    return {
                        'halted': True,
                        'reason': self.halt_reason,
                        'duration_minutes': int(self.halt_duration_minutes - elapsed)
                    }
        
        # Check consecutive losses
        if len(trade_history) >= self.consecutive_losses_threshold:
            recent_trades = trade_history[:self.consecutive_losses_threshold]
            if all(t.get('pnl', 0) < 0 for t in recent_trades):
                self._trigger_halt('3_consecutive_losses')
                return {
                    'halted': True,
                    'reason': '3_consecutive_losses',
                    'duration_minutes': self.halt_duration_minutes
                }
        
        # Check losses in window
        if len(trade_history) >= self.window_size:
            recent_trades = trade_history[:self.window_size]
            losses = sum(1 for t in recent_trades if t.get('pnl', 0) < 0)
            if losses >= self.losses_in_window:
                self._trigger_halt('5_losses_in_7_trades')
                return {
                    'halted': True,
                    'reason': '5_losses_in_7_trades',
                    'duration_minutes': self.halt_duration_minutes
                }
        
        # Check daily drawdown
        if starting_equity > 0:
            drawdown_percent = (daily_pnl / starting_equity) * 100
            if drawdown_percent <= -self.daily_drawdown_percent:
                self._trigger_halt('daily_drawdown_3pct')
                return {
                    'halted': True,
                    'reason': 'daily_drawdown_3pct',
                    'duration_minutes': self.halt_duration_minutes
                }
        
        # Check stop-out rate
        if len(trade_history) >= self.stopout_window_size:
            recent_trades = trade_history[:self.stopout_window_size]
            stopouts = sum(1 for t in recent_trades if t.get('exit_reason') == 'stop_loss')
            if stopouts >= self.stopouts_in_window:
                self._trigger_halt('4_stopouts_in_5_trades')
                return {
                    'halted': True,
                    'reason': '4_stopouts_in_5_trades',
                    'duration_minutes': self.halt_duration_minutes
                }
        
        # Check for graduated response adjustments
        self._adjust_risk_parameters(trade_history)
        
        return {
            'halted': False,
            'reason': None,
            'duration_minutes': 0
        }
    
    def _trigger_halt(self, reason: str) -> None:
        """Trigger a trading halt."""
        if not self.halted:
            self.halted = True
            self.halt_reason = reason
            self.halt_start_time = datetime.now()
            
            logger.warning(f"Circuit breaker triggered: {reason}")
            
            # Record event
            if self.database:
                self.database.record_circuit_breaker_event(
                    'halt',
                    reason,
                    self.halt_start_time,
                    None,
                    self.halt_duration_minutes,
                    self.loss_count,
                    0.0
                )
    
    def _adjust_risk_parameters(self, trade_history: List[Dict[str, Any]]) -> None:
        """
        Graduated response to losses.
        
        Args:
            trade_history: Recent trade history
        """
        if not trade_history:
            return
        
        # Count recent losses
        recent_losses = sum(1 for t in trade_history[:3] if t.get('pnl', 0) < 0)
        self.loss_count = recent_losses
        
        # After 1 loss: increase confidence threshold to 70%
        if recent_losses >= 1:
            after_1 = self.graduated_response.get('after_1_loss', {})
            self.adjusted_confidence_threshold = after_1.get('confidence_threshold', 70)
            logger.info(f"Adjusted confidence threshold to {self.adjusted_confidence_threshold}% after 1 loss")
        
        # After 2 losses: reduce risk to 0.3%, confidence to 75%, tighten spread
        if recent_losses >= 2:
            after_2 = self.graduated_response.get('after_2_losses', {})
            self.adjusted_risk_percent = after_2.get('risk_percent', 0.3)
            self.adjusted_confidence_threshold = after_2.get('confidence_threshold', 75)
            logger.info(f"Adjusted risk to {self.adjusted_risk_percent}% and confidence to {self.adjusted_confidence_threshold}% after 2 losses")
    
    def _check_reset_conditions(self, trade_history: List[Dict[str, Any]]) -> bool:
        """
        Check if reset conditions are met.
        
        Args:
            trade_history: Recent trade history
        
        Returns:
            True if reset conditions met
        """
        if len(trade_history) < 2:
            return False
        
        # 2 consecutive wins
        recent_2 = trade_history[:2]
        if all(t.get('pnl', 0) > 0 for t in recent_2):
            logger.info("Reset conditions met: 2 consecutive wins")
            return True
        
        # Single win with >1.5R profit
        if len(trade_history) >= 1:
            last_trade = trade_history[0]
            if last_trade.get('pnl', 0) > 0:
                # Calculate R (risk amount) from stop loss distance
                entry_price = last_trade.get('entry_price', 0)
                stop_loss = last_trade.get('stop_loss', 0)
                lot_size = last_trade.get('lot_size', 0)
                direction = last_trade.get('direction', 'buy')
                pnl = last_trade.get('pnl', 0)
                
                if entry_price > 0 and stop_loss > 0 and lot_size > 0:
                    # Calculate stop distance in price units
                    if direction == 'buy':
                        stop_distance_price = entry_price - stop_loss
                    else:  # sell
                        stop_distance_price = stop_loss - entry_price
                    
                    # For XAUUSD: point value = $1 per point per lot
                    # R (risk amount) = stop_distance_points * point_value_per_lot * lot_size
                    # Since stop_distance_price is already in price units, and 1 point = 0.01 for XAUUSD
                    stop_distance_points = stop_distance_price / 0.01
                    point_value_per_lot = 1.0  # $1 per point per lot for XAUUSD
                    risk_amount_r = stop_distance_points * point_value_per_lot * lot_size
                    
                    # Check if profit >= 1.5R
                    if risk_amount_r > 0 and pnl >= risk_amount_r * 1.5:
                        logger.info(f"Reset conditions met: significant win (P&L={pnl:.2f} >= 1.5R={risk_amount_r * 1.5:.2f})")
                        return True
        
        return False
    
    def _reset(self) -> None:
        """Reset circuit breaker to default state."""
        self.halted = False
        self.halt_reason = None
        self.halt_start_time = None
        self.loss_count = 0
        
        # Reset to default parameters
        self.adjusted_risk_percent = self.config.get('risk', {}).get('risk_per_trade', 0.5)
        self.adjusted_confidence_threshold = self.config.get('signals', {}).get('min_confidence', 60)
        
        logger.info("Circuit breaker reset to default parameters")
        
        # Record reset event
        if self.database:
            self.database.record_circuit_breaker_event(
                'reset',
                'Reset to default parameters',
                None,
                datetime.now(),
                0,
                self.loss_count,
                0.0
            )
    
    def reset_conditions(self, trade_history: List[Dict[str, Any]]) -> bool:
        """
        Public method to check and apply reset conditions.
        
        Args:
            trade_history: Recent trade history
        
        Returns:
            True if reset occurred
        """
        if self._check_reset_conditions(trade_history):
            self._reset()
            return True
        return False
    
    def get_current_state(self) -> CircuitBreakerState:
        """
        Get current circuit breaker state.
        
        Returns:
            CircuitBreakerState object
        """
        return CircuitBreakerState(
            halted=self.halted,
            reason=self.halt_reason,
            halt_start_time=self.halt_start_time,
            duration_minutes=self.halt_duration_minutes if self.halted else 0,
            adjusted_risk_percent=self.adjusted_risk_percent,
            adjusted_confidence_threshold=self.adjusted_confidence_threshold,
            loss_count=self.loss_count
        )

