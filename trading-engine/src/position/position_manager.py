"""
Monitors open positions and manages exits.
"""
from typing import Dict, List, Any, Optional
from datetime import datetime
from ..utils.types import Position
from ..position.exit_strategy import ExitStrategy
from ..execution.order_executor import OrderExecutor
from ..analytics.database import Database
from ..analytics.trade_recorder import TradeRecorder
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class PositionManager:
    """Manages open positions and exit execution."""
    
    def __init__(self, config: Dict[str, Any], order_executor: OrderExecutor,
                 database: Database, symbol: str = 'XAUUSD'):
        """
        Initialize position manager.
        
        Args:
            config: Configuration dictionary
            order_executor: Order executor instance
            database: Database instance
            symbol: Trading symbol (default: XAUUSD)
        """
        self.config = config
        self.order_executor = order_executor
        self.database = database
        self.exit_strategy = ExitStrategy(config)
        self.symbol = symbol
        
        # CRITICAL FIX: Initialize trade recorder to properly record exits
        self.trade_recorder = TradeRecorder(database, symbol)
        
        # Track partial exits
        self.partial_exits = {}  # ticket -> {closed_percent, remaining_lots}
    
    def monitor_positions(self, positions: List[Dict[str, Any]], 
                         market_data: Dict[str, Any],
                         indicators: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Check open positions every cycle and execute exits.
        
        Args:
            positions: List of open positions from MT5
            market_data: Current market data
            indicators: Calculated indicators
        
        Returns:
            List of exit actions taken
        """
        exit_actions = []
        
        for pos_dict in positions:
            # Convert to Position object
            position = Position(
                ticket=pos_dict['ticket'],
                symbol=pos_dict['symbol'],
                type=pos_dict['type'],
                volume=pos_dict['volume'],
                price_open=pos_dict['price_open'],
                sl=pos_dict['sl'],
                tp=pos_dict['tp'],
                profit=pos_dict['profit'],
                time=pos_dict['time'],
                partial_closed=pos_dict.get('partial_closed', False),
                partial_closed_percent=pos_dict.get('partial_closed_percent', 0.0)
            )
            
            # Get entry time from database or position
            entry_time = self._get_entry_time(position.ticket, position.time)
            
            # Evaluate exit conditions
            exit_eval = self.exit_strategy.evaluate_exits(
                position, market_data, indicators, entry_time
            )
            
            # Check partial exit
            partial_info = self.partial_exits.get(position.ticket, {})
            partial_closed = partial_info.get('closed', False)
            
            partial_exit = self.exit_strategy.check_partial_exit(
                position, market_data.get('current_price', position.price_open),
                entry_time, partial_closed
            )
            
            # Execute actions
            if exit_eval['should_exit']:
                # Full exit
                result = self.force_close(position.ticket, exit_eval['exit_reason'])
                exit_actions.append({
                    'ticket': position.ticket,
                    'action': 'close',
                    'reason': exit_eval['exit_reason'],
                    'result': result
                })
            
            elif exit_eval['action'] == 'adjust_sl':
                # Adjust stop loss to breakeven
                result = self.update_stop_loss(position.ticket, exit_eval['new_sl'])
                exit_actions.append({
                    'ticket': position.ticket,
                    'action': 'adjust_sl',
                    'new_sl': exit_eval['new_sl'],
                    'result': result
                })
            
            elif partial_exit['should_partial_exit']:
                # Partial exit
                close_percent = partial_exit['close_percent']
                result = self.partial_close(position.ticket, close_percent, 
                                          partial_exit['move_sl_to_entry'])
                exit_actions.append({
                    'ticket': position.ticket,
                    'action': 'partial_close',
                    'close_percent': close_percent,
                    'reason': partial_exit['reason'],
                    'result': result
                })
        
        return exit_actions
    
    def update_stop_loss(self, ticket: int, new_sl: float) -> Dict[str, Any]:
        """
        Move stop loss to new level.
        
        Args:
            ticket: Position ticket
            new_sl: New stop loss price
        
        Returns:
            Result dictionary
        """
        result = self.order_executor.update_stop_loss(ticket, new_sl)
        if result['success']:
            logger.info(f"Updated stop loss for ticket {ticket} to {new_sl}")
        return result
    
    def partial_close(self, ticket: int, percent: float, 
                     move_sl_to_entry: bool = True) -> Dict[str, Any]:
        """
        Close portion of position.
        
        Args:
            ticket: Position ticket
            percent: Percentage to close (e.g., 50 for 50%)
            move_sl_to_entry: Whether to move SL to entry after partial close
        
        Returns:
            Result dictionary
        """
        # Get position info
        positions = self.order_executor.mt5_connector.get_open_positions()
        position = next((p for p in positions if p['ticket'] == ticket), None)
        
        if not position:
            return {
                'success': False,
                'error': f'Position {ticket} not found'
            }
        
        # Calculate volume to close
        close_volume = position['volume'] * (percent / 100.0)
        close_volume = round(close_volume, 2)  # Round to 0.01
        
        # Close partial position
        result = self.order_executor.close_position(ticket, close_volume)
        
        if result['success']:
            # Update tracking
            if ticket not in self.partial_exits:
                self.partial_exits[ticket] = {'closed': False, 'remaining_lots': position['volume']}
            
            remaining_lots = position['volume'] - close_volume
            total_closed_percent = self.partial_exits[ticket].get('closed_percent', 0) + percent
            
            self.partial_exits[ticket] = {
                'closed': True,
                'closed_percent': total_closed_percent,
                'remaining_lots': remaining_lots
            }
            
            # Update database
            if self.database:
                self.database.update_trade_partial_close(ticket, total_closed_percent, remaining_lots)
            
            # Move SL to entry if requested
            if move_sl_to_entry:
                entry_price = position['price_open']
                buffer_points = self.exit_strategy.breakeven_buffer_points * 0.01
                
                if position['type'] == 0:  # Buy
                    new_sl = entry_price + buffer_points
                else:  # Sell
                    new_sl = entry_price - buffer_points
                
                self.update_stop_loss(ticket, new_sl)
            
            logger.info(f"Partial close: ticket={ticket}, closed={percent}%, remaining={remaining_lots} lots")
        
        return result
    
    def force_close(self, ticket: int, reason: str) -> Dict[str, Any]:
        """
        Emergency close position.
        
        Args:
            ticket: Position ticket
            reason: Reason for close
        
        Returns:
            Result dictionary
        """
        # CRITICAL FIX: Get position info BEFORE closing for exit recording
        positions = self.order_executor.mt5_connector.get_open_positions()
        position = next((p for p in positions if p['ticket'] == ticket), None)
        
        if not position:
            return {
                'success': False,
                'error': f'Position {ticket} not found'
            }
        
        # Store info for recording
        entry_price = position['price_open']
        entry_time = self._get_entry_time(ticket, position['time'])
        current_pnl = position['profit']
        
        # Close the position
        result = self.order_executor.close_position(ticket)
        
        if result['success']:
            logger.info(f"Force closed position {ticket}: {reason}")
            
            # CRITICAL FIX: Record trade exit in database
            exit_price = result.get('price', entry_price)
            exit_time = datetime.now()
            hold_time_seconds = (exit_time - entry_time).total_seconds()
            
            # Record the exit
            self.trade_recorder.record_trade_exit(
                ticket=ticket,
                exit_price=exit_price,
                pnl=current_pnl,
                hold_time_seconds=hold_time_seconds,
                exit_reason=reason
            )
            
            # Clean up partial exit tracking
            if ticket in self.partial_exits:
                del self.partial_exits[ticket]
        
        return result
    
    def get_open_positions(self) -> List[Dict[str, Any]]:
        """
        Get list of active positions.
        
        Returns:
            List of position dictionaries
        """
        return self.order_executor.mt5_connector.get_open_positions()
    
    def _parse_datetime(self, dt_str: str) -> Optional[datetime]:
        """
        Parse datetime string from database (handles ISO and SQLite formats).
        
        Args:
            dt_str: Datetime string from database
        
        Returns:
            Parsed datetime object or None if parsing fails
        """
        if isinstance(dt_str, datetime):
            return dt_str
        
        if not dt_str:
            return None
        
        # Try ISO format first (Python 3.7+)
        try:
            return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            pass
        
        # Try SQLite datetime format
        try:
            return datetime.strptime(dt_str, '%Y-%m-%d %H:%M:%S')
        except (ValueError, AttributeError):
            pass
        
        # Try SQLite datetime with microseconds
        try:
            return datetime.strptime(dt_str, '%Y-%m-%d %H:%M:%S.%f')
        except (ValueError, AttributeError):
            pass
        
        # If all parsing fails, return None
        logger.warning(f"Failed to parse datetime string: {dt_str}")
        return None
    
    def _get_entry_time(self, ticket: int, fallback_time: datetime) -> datetime:
        """
        Get entry time from database or use fallback.
        
        Args:
            ticket: Position ticket
            fallback_time: Fallback time if not in database
        
        Returns:
            Entry time
        """
        if self.database:
            # Try to get from database
            trades = self.database.get_trade_history(limit=100)
            trade = next((t for t in trades if t.get('ticket') == ticket), None)
            if trade and trade.get('entry_time'):
                parsed_time = self._parse_datetime(trade['entry_time'])
                if parsed_time is not None:
                    return parsed_time
        
        return fallback_time

