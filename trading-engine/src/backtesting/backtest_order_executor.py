"""
Simulated order executor for backtesting.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime
from ..utils.types import Signal, Position
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class BacktestOrderExecutor:
    """Simulates order execution and tracks virtual positions."""
    
    def __init__(self, config: Dict[str, Any], backtest_connector):
        """
        Initialize backtest order executor.
        
        Args:
            config: Configuration dictionary
            backtest_connector: BacktestMT5Connector instance
        """
        self.config = config
        self.backtest_connector = backtest_connector
        self.execution_config = config.get('execution', {})
        self.slippage_tolerance = self.execution_config.get('slippage_tolerance_points', 2)
        self.risk_config = config.get('risk', {})
        
        # Track virtual positions
        self.positions: Dict[int, Dict[str, Any]] = {}
        self.next_ticket = 1000  # Start ticket numbering
        self.closed_trades: List[Dict[str, Any]] = []
    
    def place_order(self, signal: Signal, lot_size: float, stop_loss: float,
                   take_profit: float, symbol: str) -> Dict[str, Any]:
        """
        Simulate order execution.
        
        Args:
            signal: Trading signal
            lot_size: Position size in lots
            stop_loss: Stop loss price
            take_profit: Take profit price
            symbol: Trading symbol
        
        Returns:
            Dictionary with 'success', 'ticket', 'price', 'error'
        """
        # Get current price
        price_data = self.backtest_connector.get_current_price(symbol)
        if not price_data:
            return {
                'success': False,
                'ticket': None,
                'price': None,
                'error': 'Failed to get current price'
            }
        
        # Determine entry price with slippage simulation
        if signal.direction == 'buy':
            entry_price = price_data['ask']
        else:  # sell
            entry_price = price_data['bid']
        
        # Simulate slippage (random small slippage)
        import random
        slippage_factor = random.uniform(0, self.slippage_tolerance * 0.01)  # Convert to price
        if signal.direction == 'buy':
            entry_price += slippage_factor
        else:
            entry_price -= slippage_factor
        
        # Create virtual position
        ticket = self.next_ticket
        self.next_ticket += 1
        
        current_time = self.backtest_connector.get_current_time()
        if not current_time:
            return {
                'success': False,
                'ticket': None,
                'price': None,
                'error': 'No current time available'
            }
        
        position = {
            'ticket': ticket,
            'symbol': symbol,
            'type': 0 if signal.direction == 'buy' else 1,  # 0=buy, 1=sell
            'volume': lot_size,
            'price_open': entry_price,
            'sl': stop_loss,
            'tp': take_profit,
            'time': current_time,
            'time_update': current_time,
            'profit': 0.0,
            'direction': signal.direction,
            'signal': signal
        }
        
        self.positions[ticket] = position
        
        logger.debug(f"Simulated order: ticket={ticket}, {signal.direction} {lot_size} lots @ {entry_price:.2f}")
        
        return {
            'success': True,
            'ticket': ticket,
            'price': entry_price,
            'execution_time_ms': 0,  # Instant in backtest
            'error': None
        }
    
    def update_positions(self, current_price_data: Dict[str, float], 
                        current_time: datetime) -> List[Dict[str, Any]]:
        """
        Update positions and check for SL/TP hits.
        
        Args:
            current_price_data: Current price data with 'bid', 'ask'
            current_time: Current simulation time
        
        Returns:
            List of closed positions
        """
        closed_positions = []
        current_candle = self.backtest_connector.get_current_candle()
        
        if not current_candle:
            return closed_positions
        
        positions_to_close = []
        
        for ticket, position in list(self.positions.items()):
            # Update position time
            position['time_update'] = current_time
            
            # Calculate current P&L
            # For XAUUSD: 1 lot = 100 oz, 1 point = $0.01, so 1 point move = $1.00 per lot
            # For 0.01 lot, 1 point move = $0.01
            if position['type'] == 0:  # Buy position
                current_price = current_price_data['bid']
                price_diff = current_price - position['price_open']
                position['profit'] = (price_diff / 0.01) * position['volume'] * 100  # Convert to points, then to dollars
            else:  # Sell position
                current_price = current_price_data['ask']
                price_diff = position['price_open'] - current_price
                position['profit'] = (price_diff / 0.01) * position['volume'] * 100
            
            # Check stop loss
            if position['type'] == 0:  # Buy
                if current_candle['low'] <= position['sl']:
                    positions_to_close.append((ticket, position['sl'], 'stop_loss'))
            else:  # Sell
                if current_candle['high'] >= position['sl']:
                    positions_to_close.append((ticket, position['sl'], 'stop_loss'))
            
            # Check take profit
            if position['type'] == 0:  # Buy
                if current_candle['high'] >= position['tp']:
                    positions_to_close.append((ticket, position['tp'], 'take_profit'))
            else:  # Sell
                if current_candle['low'] <= position['tp']:
                    positions_to_close.append((ticket, position['tp'], 'take_profit'))
        
        # Close positions
        for ticket, exit_price, exit_reason in positions_to_close:
            closed_pos = self.close_position(ticket, exit_price, exit_reason, current_time)
            if closed_pos:
                closed_positions.append(closed_pos)
        
        return closed_positions
    
    def close_position(self, ticket: int, exit_price: Optional[float] = None,
                      exit_reason: Optional[str] = None, exit_time: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
        """
        Close a virtual position.
        
        Args:
            ticket: Position ticket
            exit_price: Exit price (if None, uses current price)
            exit_reason: Reason for exit
            exit_time: Exit time (if None, uses current time)
        
        Returns:
            Closed position dictionary or None
        """
        if ticket not in self.positions:
            return None
        
        position = self.positions[ticket]
        
        if exit_time is None:
            exit_time = self.backtest_connector.get_current_time()
            if not exit_time:
                return None
        
        if exit_price is None:
            price_data = self.backtest_connector.get_current_price(position['symbol'])
            if not price_data:
                return None
            exit_price = price_data['bid'] if position['type'] == 0 else price_data['ask']
        
        # Calculate P&L
        # For XAUUSD: 1 lot = 100 oz, 1 point = $0.01, so 1 point move = $1.00 per lot
        if position['type'] == 0:  # Buy
            price_diff = exit_price - position['price_open']
            pnl = (price_diff / 0.01) * position['volume'] * 100  # Convert to points, then to dollars
        else:  # Sell
            price_diff = position['price_open'] - exit_price
            pnl = (price_diff / 0.01) * position['volume'] * 100
        
        # Calculate hold time
        hold_time = (exit_time - position['time']).total_seconds()
        
        closed_trade = {
            'ticket': ticket,
            'symbol': position['symbol'],
            'direction': position['direction'],
            'entry_price': position['price_open'],
            'exit_price': exit_price,
            'lot_size': position['volume'],
            'stop_loss': position['sl'],
            'take_profit': position['tp'],
            'entry_time': position['time'],
            'exit_time': exit_time,
            'pnl': pnl,
            'exit_reason': exit_reason or 'manual',
            'hold_time_seconds': hold_time
        }
        
        # Remove from open positions
        del self.positions[ticket]
        self.closed_trades.append(closed_trade)
        
        # Update account equity
        current_equity = self.backtest_connector.virtual_equity
        self.backtest_connector.update_equity(current_equity + pnl)
        
        logger.debug(f"Closed position: ticket={ticket}, P&L={pnl:.2f}, reason={exit_reason}")
        
        return closed_trade
    
    def get_open_positions(self, symbol: Optional[str] = None) -> List[Dict]:
        """
        Get open virtual positions.
        
        Args:
            symbol: Optional symbol filter
        
        Returns:
            List of position dictionaries
        """
        positions = list(self.positions.values())
        if symbol:
            positions = [p for p in positions if p['symbol'] == symbol]
        
        # Format to match MT5 connector format
        result = []
        for pos in positions:
            result.append({
                'ticket': pos['ticket'],
                'symbol': pos['symbol'],
                'type': pos['type'],
                'volume': pos['volume'],
                'price_open': pos['price_open'],
                'sl': pos['sl'],
                'tp': pos['tp'],
                'profit': pos['profit'],
                'time': pos['time'],
                'time_update': pos['time_update']
            })
        
        return result
    
    def calculate_take_profit(self, entry_price: float, stop_loss: float,
                            risk_reward_ratio: float, direction: str) -> float:
        """
        Calculate take profit based on risk-reward ratio.
        
        Args:
            entry_price: Entry price
            stop_loss: Stop loss price
            risk_reward_ratio: Risk-reward ratio
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
        if ticket not in self.positions:
            return {
                'success': False,
                'error': f'Position {ticket} not found'
            }
        
        self.positions[ticket]['sl'] = new_sl
        return {
            'success': True,
            'error': None
        }
    
    def get_all_closed_trades(self) -> List[Dict[str, Any]]:
        """
        Get all closed trades from backtest.
        
        Returns:
            List of closed trade dictionaries
        """
        return self.closed_trades.copy()

