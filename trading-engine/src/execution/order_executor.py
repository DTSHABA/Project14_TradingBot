"""
Order execution via MT5 API with sub-2-second latency.
"""
import MetaTrader5 as mt5  # type: ignore
from typing import Dict, Any, Optional
from datetime import datetime
from ..utils.types import Signal
from ..market_data.mt5_connector import MT5Connector
from ..execution.order_validator import OrderValidator
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class OrderExecutor:
    """Executes trades via MT5 API."""
    
    def __init__(self, config: Dict[str, Any], mt5_connector: MT5Connector):
        """
        Initialize order executor.
        
        Args:
            config: Configuration dictionary
            mt5_connector: MT5 connector instance
        """
        self.config = config
        self.mt5_connector = mt5_connector
        self.validator = OrderValidator(config)
        self.execution_config = config.get('execution', {})
        self.slippage_tolerance = self.execution_config.get('slippage_tolerance_points', 2)
        self.risk_config = config.get('risk', {})
    
    def place_order(self, signal: Signal, lot_size: float, stop_loss: float,
                   take_profit: float, symbol: str) -> Dict[str, Any]:
        """
        Execute trade via MT5 API.
        
        Args:
            signal: Trading signal
            lot_size: Position size in lots
            stop_loss: Stop loss price
            take_profit: Take profit price
            symbol: Trading symbol
        
        Returns:
            Dictionary with 'success', 'ticket', 'error'
        """
        if not self.mt5_connector.is_connected():
            return {
                'success': False,
                'ticket': None,
                'error': 'MT5 not connected'
            }
        
        # Get current price
        price_data = self.mt5_connector.get_current_price(symbol)
        if not price_data:
            return {
                'success': False,
                'ticket': None,
                'error': 'Failed to get current price'
            }
        
        # Get symbol info to check volume step
        symbol_info = mt5.symbol_info(symbol)
        if symbol_info:
            volume_min = symbol_info.volume_min
            volume_step = symbol_info.volume_step
            logger.info(f"Symbol {symbol}: volume_min={volume_min}, volume_step={volume_step}")
            
            # Adjust lot size to match broker's volume step
            if volume_step > 0:
                # Round lot size to nearest volume step
                adjusted_lot_size = round(lot_size / volume_step) * volume_step
                if adjusted_lot_size < volume_min:
                    adjusted_lot_size = volume_min
                
                if abs(adjusted_lot_size - lot_size) > 0.0001:
                    logger.warning(f"Lot size adjusted from {lot_size:.3f} to {adjusted_lot_size:.3f} "
                                 f"(volume_step={volume_step}, volume_min={volume_min})")
                    lot_size = adjusted_lot_size
        
        # Determine entry price and order type
        if signal.direction == 'buy':
            order_type = mt5.ORDER_TYPE_BUY
            entry_price = price_data['ask']
        else:  # sell
            order_type = mt5.ORDER_TYPE_SELL
            entry_price = price_data['bid']
        
        # CRITICAL FIX: Recalculate stop_loss and take_profit based on actual entry price
        # The stop_loss and take_profit were calculated using signal.price, but the actual
        # entry will be at ask/bid, which may be different. We need to maintain the same
        # stop_distance and tp_distance, but adjust them relative to the actual entry price.
        stop_distance = abs(signal.price - stop_loss)
        tp_distance = abs(take_profit - signal.price)
        
        if signal.direction == 'buy':
            # For buy: stop_loss should be below entry, take_profit above entry
            stop_loss = entry_price - stop_distance
            take_profit = entry_price + tp_distance
        else:  # sell
            # For sell: stop_loss should be above entry, take_profit below entry
            stop_loss = entry_price + stop_distance
            take_profit = entry_price - tp_distance
        
        # Validate order parameters
        validation = self.validator.validate_order_parameters(
            signal, lot_size, stop_loss, take_profit, entry_price, symbol
        )
        if not validation['valid']:
            return {
                'success': False,
                'ticket': None,
                'error': validation['reason']
            }
        
        # Prepare order request
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": lot_size,
            "type": order_type,
            "price": entry_price,
            "sl": stop_loss,
            "tp": take_profit,
            "deviation": int(self.slippage_tolerance * 10),  # Deviation in points (10x for MT5)
            "magic": 234000,  # Magic number for identification
            "comment": f"{signal.entry_type}_{signal.confidence:.0f}",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,  # Immediate or Cancel
        }
        
        # Execute order
        start_time = datetime.now()
        result = mt5.order_send(request)
        execution_time = (datetime.now() - start_time).total_seconds() * 1000  # ms
        
        if result is None:
            error_code = mt5.last_error()[0]
            error_desc = mt5.last_error()[1]
            logger.error(f"Order send failed: {error_code} - {error_desc}")
            return {
                'success': False,
                'ticket': None,
                'error': f'MT5 error {error_code}: {error_desc}'
            }
        
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            logger.warning(f"Order not executed: {result.retcode} - {result.comment}")
            return {
                'success': False,
                'ticket': None,
                'error': f'Order rejected: {result.comment}'
            }
        
        # Check slippage
        if result.price:
            slippage = abs(result.price - entry_price) / 0.01  # Convert to points
            if slippage > self.slippage_tolerance:
                logger.warning(f"Slippage {slippage:.2f} points exceeds tolerance {self.slippage_tolerance}")
        
        logger.info(f"Order executed: ticket={result.order}, price={result.price}, "
                   f"execution_time={execution_time:.0f}ms")
        
        return {
            'success': True,
            'ticket': result.order,
            'price': result.price,
            'execution_time_ms': execution_time,
            'error': None
        }
    
    def calculate_take_profit(self, entry_price: float, stop_loss: float,
                            risk_reward_ratio: float, direction: str) -> float:
        """
        Calculate take profit based on risk-reward ratio.
        
        Args:
            entry_price: Entry price
            stop_loss: Stop loss price
            risk_reward_ratio: Risk-reward ratio (e.g., 1.2 for 1:1.2)
            direction: 'buy' or 'sell'
        
        Returns:
            Take profit price
        """
        stop_distance = abs(entry_price - stop_loss)
        tp_distance = stop_distance * risk_reward_ratio
        
        if direction == 'buy':
            take_profit = entry_price + tp_distance
        else:  # sell
            take_profit = entry_price - tp_distance
        
        return round(take_profit, 2)
    
    def update_stop_loss(self, ticket: int, new_sl: float) -> Dict[str, Any]:
        """
        Update stop loss for existing position.
        
        Args:
            ticket: Position ticket
            new_sl: New stop loss price
        
        Returns:
            Dictionary with 'success' and 'error'
        """
        if not self.mt5_connector.is_connected():
            return {
                'success': False,
                'error': 'MT5 not connected'
            }
        
        request = {
            "action": mt5.TRADE_ACTION_SLTP,
            "position": ticket,
            "sl": new_sl,
        }
        
        result = mt5.order_send(request)
        
        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            error = mt5.last_error()[1] if result is None else result.comment
            logger.error(f"Failed to update stop loss for ticket {ticket}: {error}")
            return {
                'success': False,
                'error': error
            }
        
        logger.info(f"Updated stop loss for ticket {ticket} to {new_sl}")
        return {
            'success': True,
            'error': None
        }
    
    def close_position(self, ticket: int, volume: Optional[float] = None) -> Dict[str, Any]:
        """
        Close position (full or partial).
        
        Args:
            ticket: Position ticket
            volume: Volume to close (None for full close)
        
        Returns:
            Dictionary with 'success' and 'error'
        """
        if not self.mt5_connector.is_connected():
            return {
                'success': False,
                'error': 'MT5 not connected'
            }
        
        # Get position info
        positions = self.mt5_connector.get_open_positions()
        position = next((p for p in positions if p['ticket'] == ticket), None)
        
        if not position:
            return {
                'success': False,
                'error': f'Position {ticket} not found'
            }
        
        # Determine order type (opposite of position)
        if position['type'] == 0:  # Buy position
            order_type = mt5.ORDER_TYPE_SELL
            price = mt5.symbol_info_tick(position['symbol']).bid
        else:  # Sell position
            order_type = mt5.ORDER_TYPE_BUY
            price = mt5.symbol_info_tick(position['symbol']).ask
        
        close_volume = volume if volume else position['volume']
        
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": position['symbol'],
            "volume": close_volume,
            "type": order_type,
            "position": ticket,
            "price": price,
            "deviation": int(self.slippage_tolerance * 10),
            "magic": 234000,
            "comment": "Close position",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        
        result = mt5.order_send(request)
        
        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            error = mt5.last_error()[1] if result is None else result.comment
            logger.error(f"Failed to close position {ticket}: {error}")
            return {
                'success': False,
                'error': error
            }
        
        logger.info(f"Closed position {ticket} (volume: {close_volume})")
        return {
            'success': True,
            'error': None,
            'price': result.price
        }

