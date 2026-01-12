"""
Records signals and trades to database.
"""
from typing import Optional
from datetime import datetime
from ..utils.types import Signal, Trade
from ..analytics.database import Database
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class TradeRecorder:
    """Records trading activity to database."""
    
    def __init__(self, database: Database, symbol: str = 'XAUUSD'):
        """
        Initialize trade recorder.
        
        Args:
            database: Database instance
            symbol: Trading symbol (default: XAUUSD)
        """
        self.database = database
        self.symbol = symbol
    
    def record_signal(self, signal: Signal) -> Optional[str]:
        """
        Log signal to database.
        
        Args:
            signal: Signal object
        
        Returns:
            Signal ID (UUID string) or None
        """
        try:
            signal_id = self.database.record_signal(signal)
            logger.debug(f"Recorded signal: {signal.direction} {signal.entry_type} (confidence={signal.confidence:.1f}%)")
            return signal_id
        except Exception as e:
            logger.error(f"Error recording signal: {e}", exc_info=True)
            return None
    
    def record_trade_entry(self, ticket: int, signal: Signal, entry_price: float,
                          lot_size: float, stop_loss: float, take_profit: float,
                          signal_id: Optional[str] = None) -> None:
        """
        Record trade entry.
        
        Args:
            ticket: Trade ticket number
            signal: Original signal
            entry_price: Entry price
            lot_size: Position size
            stop_loss: Stop loss price
            take_profit: Take profit price
            signal_id: Optional signal ID to link trade to signal
        """
        try:
            trade = Trade(
                ticket=ticket,
                symbol=self.symbol,
                direction=signal.direction,
                entry_price=entry_price,
                lot_size=lot_size,
                stop_loss=stop_loss,
                take_profit=take_profit,
                entry_time=datetime.now(),
                exit_time=None,
                pnl=0.0,
                exit_reason=None
            )
            self.database.record_trade(trade, signal_id=signal_id)
            logger.info(f"Recorded trade entry: ticket={ticket}, {signal.direction} {lot_size} lots @ {entry_price}, signal_id={signal_id}")
        except Exception as e:
            logger.error(f"Error recording trade entry: {e}", exc_info=True)
    
    def record_trade_exit(self, ticket: int, exit_price: float, pnl: float,
                         hold_time_seconds: float, exit_reason: str) -> None:
        """
        Record trade exit.
        
        Args:
            ticket: Trade ticket number
            exit_price: Exit price
            pnl: Profit/loss
            hold_time_seconds: Time position was held
            exit_reason: Reason for exit
        """
        try:
            exit_time = datetime.now()
            self.database.update_trade_exit(
                ticket, exit_price, pnl, exit_time, exit_reason, hold_time_seconds
            )
            logger.info(f"Recorded trade exit: ticket={ticket}, P&L={pnl:.2f}, reason={exit_reason}")
        except Exception as e:
            logger.error(f"Error recording trade exit: {e}", exc_info=True)
    
    def update_trade_partial_close(self, ticket: int, closed_percent: float,
                                   remaining_lots: float) -> None:
        """
        Update trade after partial exit.
        
        Args:
            ticket: Trade ticket number
            closed_percent: Percentage closed
            remaining_lots: Remaining lot size
        """
        try:
            self.database.update_trade_partial_close(ticket, closed_percent, remaining_lots)
            logger.debug(f"Updated partial close: ticket={ticket}, closed={closed_percent}%, remaining={remaining_lots} lots")
        except Exception as e:
            logger.error(f"Error updating partial close: {e}", exc_info=True)

