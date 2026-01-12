"""
Main backtest orchestrator that replays historical data through trading engine logic.
"""
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from ..utils.logger import setup_logger
from ..utils.types import MarketData, Trade
from ..market_data.candle_processor import CandleProcessor
from ..market_data.indicators import (
    calculate_ema, calculate_rsi, calculate_atr, identify_swing_points,
    calculate_atr_average
)
from ..signals.signal_generator import SignalGenerator
from ..risk.position_sizer import PositionSizer
from ..risk.risk_validator import RiskValidator
from ..risk.circuit_breaker import CircuitBreaker
from ..session.session_manager import SessionManager
from ..session.volatility_filter import VolatilityFilter
from ..analytics.trade_recorder import TradeRecorder
from ..analytics.performance_tracker import PerformanceTracker
from .backtest_mt5_connector import BacktestMT5Connector
from .backtest_order_executor import BacktestOrderExecutor
from .backtest_database import BacktestDatabase
from .historical_data_fetcher import HistoricalDataFetcher

logger = setup_logger(__name__)


class BacktestRunner:
    """Orchestrates backtesting by replaying historical data."""
    
    def __init__(self, config: Dict[str, Any], mt5_connector):
        """
        Initialize backtest runner.
        
        Args:
            config: Configuration dictionary
            mt5_connector: Real MT5Connector for fetching historical data
        """
        self.config = config
        self.symbol = config.get('symbol', 'XAUUSD')
        self.execution_config = config.get('execution', {})
        
        # Initialize backtest components
        self.backtest_connector = BacktestMT5Connector()
        self.backtest_executor = BacktestOrderExecutor(config, self.backtest_connector)
        self.backtest_database = BacktestDatabase()
        
        # Initialize trading engine components (reuse existing logic)
        self.candle_processor = CandleProcessor()
        self.signal_generator = SignalGenerator(config)
        self.position_sizer = PositionSizer(config)
        self.risk_validator = RiskValidator(config)
        self.circuit_breaker = CircuitBreaker(config, self.backtest_database)
        self.session_manager = SessionManager(config)
        self.volatility_filter = VolatilityFilter(config)
        self.trade_recorder = TradeRecorder(self.backtest_database, self.symbol)
        self.performance_tracker = PerformanceTracker(self.backtest_database)
        
        # Historical data fetcher
        self.data_fetcher = HistoricalDataFetcher(mt5_connector)
        
        # State tracking
        self.starting_equity = 0.0
        self.total_signals = 0
        self.total_trades = 0
        self.processed_candles = 0
        self.start_date = None
        self.end_date = None
    
    def run_backtest(self, start_date: datetime, end_date: datetime, 
                    initial_equity: float = 10000.0) -> Dict[str, Any]:
        """
        Run backtest for specified date range.
        
        Args:
            start_date: Start date (inclusive)
            end_date: End date (inclusive)
            initial_equity: Starting equity
        
        Returns:
            Dictionary with backtest results
        """
        logger.info(f"Starting backtest from {start_date} to {end_date} with initial equity ${initial_equity:.2f}")
        
        self.starting_equity = initial_equity
        self.start_date = start_date
        self.end_date = end_date
        
        # Fetch historical data
        logger.info("Fetching historical data...")
        m5_candles = self.data_fetcher.fetch_historical_candles(
            self.symbol, 5, start_date, end_date
        )
        
        if not m5_candles:
            logger.error("Failed to fetch M5 historical data")
            return {'error': 'Failed to fetch M5 historical data'}
        
        # Try to fetch M1 data
        m1_candles = self.data_fetcher.fetch_historical_candles(
            self.symbol, 1, start_date, end_date
        )
        
        # If M1 data is not available, generate it from M5
        if not m1_candles:
            logger.warning("M1 historical data not available, generating from M5 candles")
            m1_candles = self.data_fetcher.generate_m1_from_m5(m5_candles)
            
            if not m1_candles:
                logger.error("Failed to generate M1 candles from M5")
                return {'error': 'Failed to generate M1 candles from M5 data'}
        
        # Validate data
        m1_validation = self.data_fetcher.validate_historical_data(m1_candles)
        m5_validation = self.data_fetcher.validate_historical_data(m5_candles)
        
        if not m1_validation['valid'] or not m5_validation['valid']:
            logger.warning(f"Data validation warnings: M1={m1_validation['reason']}, M5={m5_validation['reason']}")
        
        # Initialize backtest connector with historical data
        self.backtest_connector.initialize_historical_data(m1_candles, m5_candles, initial_equity)
        
        # Process each M1 candle sequentially
        logger.info(f"Processing {len(m1_candles)} M1 candles...")
        
        cycle_count = 0
        last_cycle_time = None
        
        while True:
            current_time = self.backtest_connector.get_current_time()
            if not current_time:
                break
            
            # Simulate 30-second cycles (but execute immediately)
            # Only process if 30 seconds have passed since last cycle (or first cycle)
            if last_cycle_time is None or (current_time - last_cycle_time).total_seconds() >= 30:
                self.simulate_cycle()
                last_cycle_time = current_time
                cycle_count += 1
                
                # Progress logging
                if cycle_count % 1000 == 0:
                    logger.info(f"Processed {cycle_count} cycles, {self.total_trades} trades executed")
            
            # Advance time
            if not self.backtest_connector.advance_time():
                break
        
        # Close any remaining open positions at end of backtest
        self._close_all_positions()
        
        # Collect results
        results = self.collect_results()
        
        logger.info(f"Backtest complete: {self.total_trades} trades, {self.total_signals} signals")
        
        return results
    
    def simulate_cycle(self) -> None:
        """Simulate one trading cycle (30-second interval)."""
        try:
            current_time = self.backtest_connector.get_current_time()
            if not current_time:
                return
            
            # Check trading window
            session_info = self.session_manager.is_trading_window(current_time)
            if not session_info['active']:
                # Still monitor positions even outside trading hours
                self._monitor_positions()
                return
            
            # Fetch market data (from historical data)
            market_data = self._fetch_market_data()
            if not market_data:
                return
            
            # Check circuit breaker
            trade_history = self.backtest_database.get_trade_history(limit=10)
            daily_pnl = self.performance_tracker.calculate_daily_pnl(current_time)
            halt_check = self.circuit_breaker.check_halts(trade_history, daily_pnl, self.starting_equity)
            
            if halt_check['halted']:
                self._monitor_positions()
                return
            
            # Monitor existing positions
            self._monitor_positions()
            
            # Check for existing positions
            open_positions = self.backtest_executor.get_open_positions(self.symbol)
            if len(open_positions) >= self.execution_config.get('max_concurrent_positions', 1):
                return
            
            # Generate signal
            m5_data = {
                'candles': market_data.m5_candles,
                'ema21': market_data.indicators['m5_ema21'],
                'swing_points': market_data.indicators['swing_points']
            }
            m1_data = {
                'candles': market_data.m1_candles,
                'rsi': market_data.indicators['m1_rsi']
            }
            
            signal = self.signal_generator.generate_signal(m5_data, m1_data, market_data.indicators)
            
            if not signal:
                return
            
            # Record signal
            self.trade_recorder.record_signal(signal)
            self.total_signals += 1
            logger.info(f"Signal generated and recorded: {signal.direction} {signal.entry_type} @ {signal.price:.2f}, confidence={signal.confidence:.1f}%")
            
            # Check confidence threshold
            cb_state = self.circuit_breaker.get_current_state()
            min_confidence = cb_state.adjusted_confidence_threshold
            
            if signal.confidence < min_confidence:
                logger.info(f"Signal rejected - Confidence {signal.confidence:.1f}% < threshold {min_confidence}%")
                return
            
            # Risk validation
            account_info = self.backtest_connector.get_account_info()
            if not account_info:
                return
            
            # ATR validation
            atr_validation = self.volatility_filter.validate_atr(
                market_data.indicators['atr'],
                market_data.indicators['atr_average']
            )
            if not atr_validation['valid']:
                logger.info(f"Signal rejected - ATR validation failed: {atr_validation.get('reason', 'Unknown')} (ATR={market_data.indicators['atr']:.2f})")
                return
            
            # Adjust confidence if ATR suboptimal
            if atr_validation.get('confidence_adjustment', 0) < 0:
                signal.confidence += atr_validation['confidence_adjustment']
                if signal.confidence < min_confidence:
                    logger.info(f"Signal rejected - ATR-adjusted confidence {signal.confidence:.1f}% < threshold {min_confidence}%")
                    return
            
            # Check for neutral trend adjustments
            alignment_result = signal.alignment_result
            is_neutral_trend = alignment_result and alignment_result.get('is_neutral_trend', False)
            
            # Get stop loss percent (adjust for neutral trends)
            signal_config = self.config.get('signals', {})
            trend_alignment = signal_config.get('trend_alignment', {})
            neutral_rules = trend_alignment.get('neutral_trend_rules', {})
            
            if is_neutral_trend:
                stop_percent = neutral_rules.get('tighter_stop', 0.25)
                position_size_multiplier = neutral_rules.get('reduce_position_size', 0.7)
            else:
                stop_percent = self.config.get('risk', {}).get('stop_loss_range', {}).get('preferred', 0.30)
                position_size_multiplier = 1.0
            
            # Calculate stop distance
            stop_distance = self.position_sizer.calculate_stop_distance(
                signal.price,
                stop_percent
            )
            
            # Apply risk multiplier from session and neutral trend adjustment
            risk_percent = cb_state.adjusted_risk_percent * session_info['risk_multiplier'] * position_size_multiplier
            
            # Calculate lot size
            lot_size = self.position_sizer.calculate_lot_size(
                account_info.equity, risk_percent, stop_distance, self.symbol
            )
            
            if lot_size <= 0:
                logger.info(f"Signal rejected - Invalid lot size: {lot_size} (equity={account_info.equity:.2f}, risk={risk_percent:.2f}%, stop={stop_distance:.2f}pts)")
                return
            
            # Calculate stop loss and take profit
            # Note: stop_distance is in points (e.g., 30 points)
            # For XAUUSD, 1 point = 0.01, so we multiply by 0.01 to convert to price units
            if signal.direction == 'buy':
                stop_loss = signal.price - (stop_distance * 0.01)
            else:
                stop_loss = signal.price + (stop_distance * 0.01)
            
            risk_reward_ratio = self.config.get('risk', {}).get('risk_reward_ratio', {}).get('preferred', 1.2)
            take_profit = self.backtest_executor.calculate_take_profit(
                signal.price, stop_loss, risk_reward_ratio, signal.direction
            )
            
            # Risk validation
            market_data_dict = {
                'spread': market_data.spread,
                'atr': market_data.indicators['atr'],
                'atr_average': market_data.indicators['atr_average'],
                'open_positions': open_positions
            }
            
            validation = self.risk_validator.validate_signal(
                signal, market_data_dict, account_info, self.config,
                session_info['session_type']
            )
            
            if not validation['valid']:
                logger.info(f"Signal rejected - Risk validation failed: {validation.get('reason', 'Unknown')} (spread={market_data.spread:.2f}, ATR={market_data.indicators['atr']:.2f})")
                return
            
            # Execute order
            order_result = self.backtest_executor.place_order(
                signal, lot_size, stop_loss, take_profit, self.symbol
            )
            
            if order_result['success']:
                self.trade_recorder.record_trade_entry(
                    order_result['ticket'],
                    signal,
                    order_result['price'],
                    lot_size,
                    stop_loss,
                    take_profit
                )
                self.total_trades += 1
                logger.info(f"Trade executed: ticket={order_result['ticket']}, {signal.direction} {lot_size} lots @ {order_result['price']:.2f}, SL={stop_loss:.2f}, TP={take_profit:.2f}")
            else:
                logger.debug(f"Signal rejected - Order execution failed: {order_result.get('error', 'Unknown')}")
        
        except Exception as e:
            logger.error(f"Error in backtest cycle: {e}", exc_info=True)
    
    def _fetch_market_data(self) -> Optional[MarketData]:
        """Fetch market data from historical candles."""
        try:
            # Get candles up to current time
            m1_candles = self.backtest_connector.get_candles(self.symbol, 1, 30)
            m5_candles = self.backtest_connector.get_candles(self.symbol, 5, 30)
            
            if not m1_candles or not m5_candles or len(m1_candles) < 10 or len(m5_candles) < 10:
                return None
            
            # Validate and clean
            if not self.candle_processor.validate_candles(m1_candles, 10):
                return None
            if not self.candle_processor.validate_candles(m5_candles, 10):
                return None
            
            m1_candles = self.candle_processor.clean_candles(m1_candles)
            m5_candles = self.candle_processor.clean_candles(m5_candles)
            
            # Get current price
            price_data = self.backtest_connector.get_current_price(self.symbol)
            if not price_data:
                return None
            
            # Calculate indicators
            m5_closes = [c['close'] for c in m5_candles]
            m1_closes = [c['close'] for c in m1_candles]
            
            m5_ema21 = calculate_ema(m5_closes, 21)
            m1_rsi = calculate_rsi(m1_closes, 14)
            m5_rsi = calculate_rsi(m5_closes, 14)
            
            # Calculate ATR from M5 candles (matching live system)
            # Live system uses M5 ATR in price units, but volatility filter expects points
            # So we convert M5 ATR from price units to points (divide by 0.01 for XAUUSD)
            m5_highs = [c['high'] for c in m5_candles]
            m5_lows = [c['low'] for c in m5_candles]
            atr_values_m5 = calculate_atr(m5_highs, m5_lows, m5_closes, 14)
            
            if atr_values_m5:
                # Convert M5 ATR from price units to points for volatility filter
                # For XAUUSD: 1 point = 0.01, so divide by 0.01
                atr_points = [(atr / 0.01) for atr in atr_values_m5]
                atr_average = calculate_atr_average(atr_points, 20) if atr_points else 0.0
                current_atr = atr_points[-1] if atr_points else 0.0
            else:
                atr_average = 0.0
                current_atr = 0.0
            
            swing_points = identify_swing_points(m5_candles, 10)
            
            indicators = {
                'm5_ema21': m5_ema21,
                'm1_rsi': m1_rsi,
                'm5_rsi': m5_rsi,
                'atr': current_atr,  # M1-level ATR in points
                'atr_average': atr_average,
                'swing_points': swing_points
            }
            
            current_price = (price_data['bid'] + price_data['ask']) / 2
            
            return MarketData(
                m1_candles=m1_candles,
                m5_candles=m5_candles,
                current_price=current_price,
                bid=price_data['bid'],
                ask=price_data['ask'],
                spread=price_data['spread'],
                indicators=indicators
            )
        
        except Exception as e:
            logger.error(f"Error fetching market data: {e}", exc_info=True)
            return None
    
    def _monitor_positions(self) -> None:
        """Monitor and update open positions."""
        try:
            open_positions = self.backtest_executor.get_open_positions(self.symbol)
            if not open_positions:
                return
            
            # Get current price
            price_data = self.backtest_connector.get_current_price(self.symbol)
            if not price_data:
                return
            
            current_time = self.backtest_connector.get_current_time()
            if not current_time:
                return
            
            # Update positions and check for SL/TP hits
            closed_positions = self.backtest_executor.update_positions(price_data, current_time)
            
            # Record closed trades
            for closed_pos in closed_positions:
                self.trade_recorder.record_trade_exit(
                    closed_pos['ticket'],
                    closed_pos['exit_price'],
                    closed_pos['pnl'],
                    closed_pos['hold_time_seconds'],
                    closed_pos['exit_reason']
                )
            
            # Check time-based exits and other exit conditions
            # (This would be handled by position manager in live system)
            # For backtest, we handle SL/TP in update_positions
            
        except Exception as e:
            logger.error(f"Error monitoring positions: {e}", exc_info=True)
    
    def _close_all_positions(self) -> None:
        """Close all remaining open positions at end of backtest."""
        open_positions = self.backtest_executor.get_open_positions(self.symbol)
        current_time = self.backtest_connector.get_current_time()
        
        for pos in open_positions:
            price_data = self.backtest_connector.get_current_price(self.symbol)
            if price_data:
                exit_price = price_data['bid'] if pos['type'] == 0 else price_data['ask']
                closed_pos = self.backtest_executor.close_position(
                    pos['ticket'],
                    exit_price,
                    'backtest_end',
                    current_time
                )
                if closed_pos:
                    self.trade_recorder.record_trade_exit(
                        closed_pos['ticket'],
                        closed_pos['exit_price'],
                        closed_pos['pnl'],
                        closed_pos['hold_time_seconds'],
                        closed_pos['exit_reason']
                    )
    
    def collect_results(self) -> Dict[str, Any]:
        """
        Collect and aggregate backtest results.
        
        Returns:
            Dictionary with comprehensive backtest results
        """
        # Get all closed trades
        all_trades = self.backtest_database.get_backtest_trades()
        
        # Get summary statistics
        summary = self.backtest_database.get_backtest_summary()
        
        # Calculate additional metrics
        final_equity = self.backtest_connector.virtual_equity
        total_return = ((final_equity - self.starting_equity) / self.starting_equity) * 100
        
        # Calculate drawdown
        equity_curve = []
        running_equity = self.starting_equity
        max_equity = self.starting_equity
        max_drawdown = 0.0
        
        for trade in sorted(all_trades, key=lambda x: x['entry_time']):
            running_equity += trade.get('pnl', 0)
            equity_curve.append(running_equity)
            if running_equity > max_equity:
                max_equity = running_equity
            drawdown = ((max_equity - running_equity) / max_equity) * 100
            if drawdown > max_drawdown:
                max_drawdown = drawdown
        
        return {
            'summary': summary,
            'starting_equity': self.starting_equity,
            'final_equity': final_equity,
            'total_return_percent': total_return,
            'max_drawdown_percent': max_drawdown,
            'total_trades': len(all_trades),
            'total_signals': self.total_signals,
            'trades': all_trades,
            'equity_curve': equity_curve,
            'start_date': self.start_date,
            'end_date': self.end_date
        }

