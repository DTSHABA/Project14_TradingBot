"""
Main entry point and execution loop for trading engine.
"""
import time
import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables first, before any other imports
# Try loading from current directory and trading-engine directory
trading_engine_dir = Path(__file__).parent.parent
env_path = trading_engine_dir / '.env'

# Load .env file explicitly (overwrite=False means existing env vars take precedence)
if env_path.exists():
    load_dotenv(env_path, override=False)
    print(f"[OK] Loaded .env file from: {env_path}")
else:
    # Also try loading from current directory
    load_dotenv(override=False)
    if not os.getenv('TRADING_ENGINE_USER_ID'):
        print(f"[WARNING] .env file not found at: {env_path}")
        print(f"   Please create a .env file or set environment variables.")

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from config.config_loader import ConfigLoader
from src.utils.logger import setup_logger
from src.utils.types import MarketData
from src.market_data.mt5_connector import MT5Connector
from src.market_data.candle_processor import CandleProcessor
from src.market_data.indicators import (
    calculate_ema, calculate_rsi, calculate_atr, identify_swing_points,
    calculate_atr_average
)
from src.signals.signal_generator import SignalGenerator
from src.risk.position_sizer import PositionSizer
from src.risk.risk_validator import RiskValidator
from src.risk.circuit_breaker import CircuitBreaker
from src.execution.order_executor import OrderExecutor
from src.position.position_manager import PositionManager
from src.session.session_manager import SessionManager
from src.session.volatility_filter import VolatilityFilter
from src.analytics.database import Database
from src.analytics.trade_recorder import TradeRecorder
from src.analytics.performance_tracker import PerformanceTracker

logger = setup_logger(__name__)


class ExecutionLoop:
    """30-second cycle orchestrator."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize execution loop.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.execution_config = config.get('execution', {})
        self.cycle_interval = self.execution_config.get('cycle_interval_seconds', 30)
        self.symbol = config.get('symbol', 'XAUUSD')
        
        # Initialize components
        self.mt5_connector = MT5Connector()
        self.candle_processor = CandleProcessor()
        self.signal_generator = SignalGenerator(config)
        self.position_sizer = PositionSizer(config)
        self.risk_validator = RiskValidator(config)
        # Initialize PostgreSQL database with connection pooling
        db_config = config.get('database', {})
        self.database = Database(
            connection_string=db_config.get('connection_string'),
            user_id=db_config.get('user_id'),
            mt5_account_id=db_config.get('mt5_account_id'),
            min_connections=db_config.get('min_connections', 2),
            max_connections=db_config.get('max_connections', 10)
        )
        self.circuit_breaker = CircuitBreaker(config, self.database)
        self.order_executor = OrderExecutor(config, self.mt5_connector)
        self.position_manager = PositionManager(config, self.order_executor, self.database, self.symbol)
        self.session_manager = SessionManager(config)
        self.volatility_filter = VolatilityFilter(config)
        self.trade_recorder = TradeRecorder(self.database, self.symbol)
        self.performance_tracker = PerformanceTracker(self.database)
        
        self.running = False
        self.starting_equity = 0.0
        
        # CRITICAL FIX: Track previous cycle's open positions to detect MT5 auto-closed positions
        self.previous_open_positions: set = set()  # Set of ticket IDs from previous cycle
        
        # Track last signal outcome for status display
        self.last_signal_outcome: Optional[Dict[str, Any]] = None
    
    def initialize_system(self) -> bool:
        """
        Set up MT5 connection, load config, initialize database.
        
        Returns:
            True if initialization successful
        """
        try:
            # Load MT5 credentials
            config_loader = ConfigLoader()
            mt5_creds = config_loader.get_mt5_credentials()
            
            # Connect to MT5
            if not self.mt5_connector.connect(
                int(mt5_creds['login']),
                mt5_creds['password'],
                mt5_creds['server'],
                mt5_creds.get('path', None)
            ):
                logger.error("Failed to connect to MT5")
                return False
            
            # Get starting equity
            account_info = self.mt5_connector.get_account_info()
            if account_info:
                self.starting_equity = account_info.equity
                logger.info(f"Starting equity: ${self.starting_equity:.2f}")
            
            # CRITICAL FIX: Initialize previous_open_positions with current open positions
            # This prevents false positives on first cycle
            open_positions = self.mt5_connector.get_open_positions(self.symbol)
            if open_positions:
                self.previous_open_positions = set(p['ticket'] for p in open_positions)
                logger.info(f"Initialized position tracking with {len(self.previous_open_positions)} open positions")
            else:
                self.previous_open_positions = set()
            
            logger.info("System initialized successfully")
            return True
        
        except Exception as e:
            logger.error(f"Initialization error: {e}", exc_info=True)
            return False
    
    def fetch_market_data(self) -> Optional[MarketData]:
        """
        Fetch and process market data.
        
        Returns:
            MarketData object or None
        """
        try:
            # Fetch M1 and M5 candles
            # Fetch 30 candles to ensure we have enough for EMA21 (needs 21) and other indicators
            m1_candles = self.mt5_connector.get_candles(self.symbol, 1, 30)  # M1, 30 candles
            m5_candles = self.mt5_connector.get_candles(self.symbol, 5, 30)  # M5, 30 candles
            
            if not m1_candles or not m5_candles:
                logger.warning("Failed to fetch candles")
                return None
            
            # Validate and clean
            if not self.candle_processor.validate_candles(m1_candles, 10):
                logger.warning("M1 candles validation failed")
                return None
            
            if not self.candle_processor.validate_candles(m5_candles, 10):
                logger.warning("M5 candles validation failed")
                return None
            
            m1_candles = self.candle_processor.clean_candles(m1_candles)
            m5_candles = self.candle_processor.clean_candles(m5_candles)
            
            # Get current price
            price_data = self.mt5_connector.get_current_price(self.symbol)
            if not price_data:
                return None
            
            # Calculate indicators
            m5_closes = [c['close'] for c in m5_candles]
            m1_closes = [c['close'] for c in m1_candles]
            
            m5_ema21 = calculate_ema(m5_closes, 21)
            m1_rsi = calculate_rsi(m1_closes, 14)
            m5_rsi = calculate_rsi(m5_closes, 14)
            
            m5_highs = [c['high'] for c in m5_candles]
            m5_lows = [c['low'] for c in m5_candles]
            atr_values = calculate_atr(m5_highs, m5_lows, m5_closes, 14)
            atr_average = calculate_atr_average(atr_values, 20) if atr_values else 0.0
            
            swing_points = identify_swing_points(m5_candles, 10)
            
            indicators = {
                'm5_ema21': m5_ema21,
                'm1_rsi': m1_rsi,
                'm5_rsi': m5_rsi,
                'atr': atr_values[-1] if atr_values else 0.0,
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
    
    def run_cycle(self) -> None:
        """Execute one trading cycle."""
        try:
            # Check session
            session_info = self.session_manager.is_trading_window()
            if not session_info['active']:
                # Log at INFO level every 10th cycle (every 5 minutes) to avoid spam
                if int(time.time()) % 300 < 30:  # Log roughly every 5 minutes
                    logger.info(f"Not in trading window: {session_info['reason']}")
                else:
                    logger.debug(f"Not in trading window: {session_info['reason']}")
                # Still monitor positions even outside trading hours
                self._monitor_positions()
                return
            
            # Fetch market data
            market_data = self.fetch_market_data()
            if not market_data:
                logger.warning("Failed to fetch market data, skipping cycle")
                return
            
            # Check circuit breaker
            trade_history = self.database.get_trade_history(limit=10)
            daily_pnl = self.performance_tracker.calculate_daily_pnl()
            halt_check = self.circuit_breaker.check_halts(trade_history, daily_pnl, self.starting_equity)
            
            if halt_check['halted']:
                logger.warning(f"Trading halted: {halt_check['reason']}")
                self._monitor_positions()
                return
            
            # Monitor existing positions
            self._monitor_positions()
            
            # Check for existing positions
            open_positions = self.mt5_connector.get_open_positions(self.symbol)
            if len(open_positions) >= self.execution_config.get('max_concurrent_positions', 1):
                logger.debug("Maximum positions already open")
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
                # Log at INFO level occasionally to show the bot is checking
                if int(time.time()) % 300 < 30:  # Log roughly every 5 minutes
                    logger.info("No signal generated - market conditions not met")
                else:
                    logger.debug("No signal generated")
                self.last_signal_outcome = {
                    'status': 'no_signal',
                    'reason': 'Market conditions not met - no momentum/entry conditions'
                }
                return
            
            # Record signal and capture signal_id for trade linking
            signal_id = self.trade_recorder.record_signal(signal)
            
            # Check confidence threshold (with circuit breaker adjustment)
            cb_state = self.circuit_breaker.get_current_state()
            min_confidence = cb_state.adjusted_confidence_threshold
            
            if signal.confidence < min_confidence:
                logger.info("=" * 80)
                logger.info(f"❌ TRADE REJECTED: Circuit Breaker Confidence Threshold")
                logger.info(f"   Signal: {signal.direction.upper()} {signal.entry_type} @ ${signal.price:.2f}")
                logger.info(f"   Signal Confidence: {signal.confidence:.1f}% < Circuit Breaker Threshold: {min_confidence}%")
                logger.info(f"   Gap: {min_confidence - signal.confidence:.1f}% below required")
                logger.info(f"   Circuit Breaker State: Risk={cb_state.adjusted_risk_percent:.2f}%, Confidence Threshold={min_confidence:.1f}%")
                logger.info(f"   Reason: Signal generated but filtered by circuit breaker after recent losses")
                logger.info("=" * 80)
                self.last_signal_outcome = {
                    'status': 'rejected',
                    'stage': 'circuit_breaker',
                    'signal': f"{signal.direction.upper()} {signal.entry_type}",
                    'confidence': signal.confidence,
                    'threshold': min_confidence,
                    'reason': f'Confidence {signal.confidence:.1f}% < {min_confidence}% (circuit breaker after losses)'
                }
                return
            
            # Risk validation
            account_info = self.mt5_connector.get_account_info()
            if not account_info:
                logger.error("=" * 80)
                logger.error(f"❌ TRADE REJECTED: Failed to get account info")
                logger.error(f"   Signal: {signal.direction.upper()} {signal.entry_type} @ ${signal.price:.2f}")
                logger.error("=" * 80)
                self.last_signal_outcome = {
                    'status': 'rejected',
                    'stage': 'account_info',
                    'reason': 'Failed to get account info from MT5'
                }
                return
            
            # ATR validation
            atr_validation = self.volatility_filter.validate_atr(
                market_data.indicators['atr'],
                market_data.indicators['atr_average']
            )
            if not atr_validation['valid']:
                logger.info("=" * 80)
                logger.info(f"❌ TRADE REJECTED: ATR Validation Failed")
                logger.info(f"   Signal: {signal.direction.upper()} {signal.entry_type} @ ${signal.price:.2f}")
                logger.info(f"   ATR: {market_data.indicators['atr']:.2f} | ATR Average: {market_data.indicators['atr_average']:.2f}")
                logger.info(f"   Reason: {atr_validation.get('reason', 'Unknown ATR issue')}")
                logger.info("=" * 80)
                self.last_signal_outcome = {
                    'status': 'rejected',
                    'stage': 'atr_validation',
                    'signal': f"{signal.direction.upper()} {signal.entry_type}",
                    'confidence': signal.confidence,
                    'reason': atr_validation.get('reason', 'ATR validation failed')
                }
                return
            
            # Adjust confidence if ATR suboptimal
            original_confidence = signal.confidence
            if atr_validation['confidence_adjustment'] < 0:
                signal.confidence += atr_validation['confidence_adjustment']
                if signal.confidence < min_confidence:
                    logger.info("=" * 80)
                    logger.info(f"❌ TRADE REJECTED: ATR-Adjusted Confidence Too Low")
                    logger.info(f"   Signal: {signal.direction.upper()} {signal.entry_type} @ ${signal.price:.2f}")
                    logger.info(f"   Original Confidence: {original_confidence:.1f}%")
                    logger.info(f"   ATR Adjustment: {atr_validation['confidence_adjustment']:.1f}%")
                    logger.info(f"   Adjusted Confidence: {signal.confidence:.1f}% < Threshold: {min_confidence:.1f}%")
                    logger.info(f"   ATR: {market_data.indicators['atr']:.2f} | ATR Average: {market_data.indicators['atr_average']:.2f}")
                    logger.info("=" * 80)
                    self.last_signal_outcome = {
                        'status': 'rejected',
                        'stage': 'atr_adjusted_confidence',
                        'signal': f"{signal.direction.upper()} {signal.entry_type}",
                        'original_confidence': original_confidence,
                        'adjusted_confidence': signal.confidence,
                        'threshold': min_confidence,
                        'reason': f'ATR-adjusted confidence {signal.confidence:.1f}% < {min_confidence}%'
                    }
                    return
            
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
                logger.info("=" * 80)
                logger.info(f"❌ TRADE REJECTED: Risk Validation Failed")
                logger.info(f"   Signal: {signal.direction.upper()} {signal.entry_type} @ ${signal.price:.2f}")
                logger.info(f"   Reason: {validation.get('reason', 'Unknown risk issue')}")
                logger.info(f"   Market Conditions: Spread={market_data.spread:.2f}, ATR={market_data.indicators['atr']:.2f}")
                logger.info(f"   Account: Equity=${account_info.equity:.2f}, Balance=${account_info.balance:.2f}")
                logger.info("=" * 80)
                self.last_signal_outcome = {
                    'status': 'rejected',
                    'stage': 'risk_validation',
                    'signal': f"{signal.direction.upper()} {signal.entry_type}",
                    'confidence': signal.confidence,
                    'reason': validation.get('reason', 'Risk validation failed')
                }
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
                logger.info(f"Neutral trend detected: using {stop_percent}% SL and {position_size_multiplier}x position size")
            else:
                stop_percent = self.config.get('risk', {}).get('stop_loss_range', {}).get('preferred', 0.30)
                position_size_multiplier = 1.0
            
            # Calculate position size
            stop_distance = self.position_sizer.calculate_stop_distance(
                signal.price,
                stop_percent
            )
            
            # Apply risk multiplier from session and neutral trend adjustment
            risk_percent = cb_state.adjusted_risk_percent * session_info['risk_multiplier'] * position_size_multiplier
            
            lot_size = self.position_sizer.calculate_lot_size(
                account_info.equity, risk_percent, stop_distance, self.symbol
            )
            
            # Calculate stop loss and take profit
            # Note: stop_distance is in points (e.g., 30 points)
            # For XAUUSD, 1 point = 0.01, so we multiply by 0.01 to convert to price units
            if signal.direction == 'buy':
                stop_loss = signal.price - (stop_distance * 0.01)
            else:
                stop_loss = signal.price + (stop_distance * 0.01)
            
            risk_reward_ratio = self.config.get('risk', {}).get('risk_reward_ratio', {}).get('preferred', 1.2)
            take_profit = self.order_executor.calculate_take_profit(
                signal.price, stop_loss, risk_reward_ratio, signal.direction
            )
            
            # Log execution attempt with full details
            logger.info("=" * 80)
            logger.info(f"🚀 ATTEMPTING TRADE EXECUTION")
            logger.info(f"   Signal: {signal.direction.upper()} {signal.entry_type} @ ${signal.price:.2f}")
            logger.info(f"   Confidence: {signal.confidence:.1f}% (Threshold: {min_confidence:.1f}%)")
            logger.info(f"   Position: {lot_size:.3f} lots | Risk: {risk_percent:.2f}% (${account_info.equity * risk_percent / 100:.2f})")
            logger.info(f"   Stop Loss: ${stop_loss:.2f} ({abs(signal.price - stop_loss):.2f} points)")
            logger.info(f"   Take Profit: ${take_profit:.2f} ({abs(take_profit - signal.price):.2f} points)")
            logger.info(f"   Risk/Reward: {abs(take_profit - signal.price) / abs(signal.price - stop_loss):.2f}:1")
            logger.info(f"   Market: Spread={market_data.spread:.2f}, ATR={market_data.indicators['atr']:.2f}")
            if is_neutral_trend:
                logger.info(f"   ⚠️  Neutral Trend: Using tighter SL ({stop_percent}%) and reduced size ({position_size_multiplier}x)")
            logger.info("=" * 80)
            
            # Execute order
            result = self.order_executor.place_order(
                signal, lot_size, stop_loss, take_profit, self.symbol
            )
            
            if result['success']:
                logger.info("=" * 80)
                logger.info(f"✅ TRADE EXECUTED SUCCESSFULLY")
                logger.info(f"   Ticket: {result['ticket']} | Direction: {signal.direction.upper()}")
                logger.info(f"   Entry Price: ${result['price']:.2f} | Lot Size: {lot_size:.3f}")
                logger.info(f"   Stop Loss: ${stop_loss:.2f} | Take Profit: ${take_profit:.2f}")
                logger.info(f"   Risk: {risk_percent:.2f}% (${account_info.equity * risk_percent / 100:.2f})")
                logger.info("=" * 80)
                self.trade_recorder.record_trade_entry(
                    result['ticket'], signal, result['price'], lot_size, stop_loss, take_profit, signal_id=signal_id
                )
                self.last_signal_outcome = {
                    'status': 'executed',
                    'ticket': result['ticket'],
                    'signal': f"{signal.direction.upper()} {signal.entry_type}",
                    'price': result['price'],
                    'lot_size': lot_size
                }
            else:
                logger.warning("=" * 80)
                logger.warning(f"❌ ORDER EXECUTION FAILED")
                logger.warning(f"   Signal: {signal.direction.upper()} {signal.entry_type} @ ${signal.price:.2f}")
                logger.warning(f"   Error: {result.get('error', 'Unknown error')}")
                logger.warning("=" * 80)
                self.last_signal_outcome = {
                    'status': 'execution_failed',
                    'signal': f"{signal.direction.upper()} {signal.entry_type}",
                    'error': result.get('error', 'Unknown error')
                }
        
        except Exception as e:
            logger.error(f"Error in execution cycle: {e}", exc_info=True)
    
    def _monitor_positions(self) -> None:
        """Monitor and manage open positions."""
        try:
            import MetaTrader5 as mt5
            
            open_positions = self.mt5_connector.get_open_positions(self.symbol)
            current_open_tickets = set(p['ticket'] for p in open_positions) if open_positions else set()
            
            # CRITICAL FIX: Detect positions closed by MT5 (SL/TP) that disappeared
            closed_by_mt5 = self.previous_open_positions - current_open_tickets
            
            if closed_by_mt5:
                logger.info(f"Detected {len(closed_by_mt5)} positions closed by MT5 (SL/TP)")
                
                # Query MT5 history for exit details
                for ticket in closed_by_mt5:
                    try:
                        # Get deals for this position
                        deals = mt5.history_deals_get(position=ticket)
                        if deals:
                            # Find the close deal (entry = OUT)
                            close_deals = [d for d in deals if d.entry == mt5.DEAL_ENTRY_OUT]
                            if close_deals:
                                close_deal = close_deals[-1]  # Most recent close
                                
                                # Get entry time from database
                                trade = self.database.get_trade_by_ticket(ticket)
                                
                                if trade and trade.get('entry_time'):
                                    entry_time = datetime.fromisoformat(
                                        trade['entry_time'].replace('Z', '+00:00').replace('+00:00', '')
                                    )
                                else:
                                    # Fallback: use deal time minus estimated hold time
                                    entry_time = datetime.fromtimestamp(close_deal.time) - timedelta(minutes=2)
                                
                                exit_time = datetime.fromtimestamp(close_deal.time)
                                hold_time_seconds = (exit_time - entry_time).total_seconds()
                                
                                # Calculate total P&L from all close deals for this position
                                total_pnl = sum(d.profit for d in close_deals)
                                
                                # Determine exit reason
                                exit_reason = 'stop_loss'  # Default
                                comment = str(close_deal.comment or '').lower()
                                if 'tp' in comment or 'take profit' in comment:
                                    exit_reason = 'take_profit'
                                elif 'sl' in comment or 'stop loss' in comment:
                                    exit_reason = 'stop_loss'
                                else:
                                    exit_reason = 'mt5_auto_close'
                                
                                # Record the exit
                                self.trade_recorder.record_trade_exit(
                                    ticket=ticket,
                                    exit_price=close_deal.price,
                                    pnl=total_pnl,
                                    hold_time_seconds=hold_time_seconds,
                                    exit_reason=exit_reason
                                )
                                
                                logger.info(f"Recorded MT5 auto-close: ticket={ticket}, P&L=${total_pnl:.2f}, reason={exit_reason}")
                            else:
                                logger.warning(f"No close deal found for position {ticket}")
                        else:
                            logger.warning(f"No deals found for position {ticket}")
                    except Exception as e:
                        logger.error(f"Error recording MT5 auto-close for ticket {ticket}: {e}", exc_info=True)
            
            if not open_positions:
                # Update tracking
                self.previous_open_positions = set()
                return
            
            # Fetch market data for exit evaluation
            market_data = self.fetch_market_data()
            if not market_data:
                # Update tracking even if market data fetch fails
                self.previous_open_positions = current_open_tickets
                return
            
            # Monitor positions
            exit_actions = self.position_manager.monitor_positions(
                open_positions, {
                    'current_price': market_data.current_price,
                    'm1_candles': market_data.m1_candles
                },
                market_data.indicators
            )
            
            # Record exits from position manager
            for action in exit_actions:
                if action['action'] == 'close' and action['result']['success']:
                    # Get position info to calculate P&L
                    position = next(
                        (p for p in open_positions if p['ticket'] == action['ticket']),
                        None
                    )
                    if position:
                        exit_price = action['result'].get('price', market_data.current_price)
                        pnl = position['profit']
                        hold_time = (datetime.now() - position['time']).total_seconds()
                        
                        self.trade_recorder.record_trade_exit(
                            action['ticket'], exit_price, pnl, hold_time, action['reason']
                        )
            
            # Update tracking for next cycle
            self.previous_open_positions = current_open_tickets
        
        except Exception as e:
            logger.error(f"Error monitoring positions: {e}", exc_info=True)
    
    def run(self) -> None:
        """Main execution loop."""
        self.running = True
        logger.info("Starting trading engine execution loop")
        
        try:
            while self.running:
                cycle_start = time.time()
                
                self.run_cycle()
                
                # Display status
                self._display_status()
                
                # Sleep until next cycle
                elapsed = time.time() - cycle_start
                sleep_time = max(0, self.cycle_interval - elapsed)
                time.sleep(sleep_time)
        
        except KeyboardInterrupt:
            logger.info("Received interrupt signal, shutting down...")
        except Exception as e:
            logger.error(f"Fatal error in execution loop: {e}", exc_info=True)
        finally:
            self.shutdown()
    
    def _display_status(self) -> None:
        """Display current system status."""
        try:
            account_info = self.mt5_connector.get_account_info()
            open_positions = self.mt5_connector.get_open_positions(self.symbol)
            cb_state = self.circuit_breaker.get_current_state()
            recent_signals = self.database.get_recent_signals(limit=5)
            
            # Check trading window
            session_info = self.session_manager.is_trading_window()
            window_status = "✅ ACTIVE" if session_info['active'] else f"❌ CLOSED ({session_info['reason']})"
            
            # Get trade history for context
            trade_history = self.database.get_trade_history(limit=10)
            total_trades = len(trade_history)
            recent_wins = sum(1 for t in trade_history[:5] if t.get('pnl', 0) > 0)
            recent_losses = sum(1 for t in trade_history[:5] if t.get('pnl', 0) < 0)
            
            # Add last signal outcome information
            signal_outcome_info = ""
            if self.last_signal_outcome:
                outcome = self.last_signal_outcome
                if outcome['status'] == 'executed':
                    signal_outcome_info = f"✅ Last: {outcome.get('signal', 'N/A')} EXECUTED (Ticket: {outcome.get('ticket', 'N/A')})"
                elif outcome['status'] == 'rejected':
                    stage = outcome.get('stage', 'unknown')
                    reason = outcome.get('reason', 'Unknown reason')
                    signal_outcome_info = f"❌ Last: {outcome.get('signal', 'N/A')} REJECTED at {stage} - {reason}"
                    if 'confidence' in outcome and 'threshold' in outcome:
                        signal_outcome_info += f" (Conf: {outcome['confidence']:.1f}% < {outcome['threshold']:.1f}%)"
                elif outcome['status'] == 'execution_failed':
                    signal_outcome_info = f"⚠️  Last: {outcome.get('signal', 'N/A')} EXECUTION FAILED - {outcome.get('error', 'Unknown')}"
                elif outcome['status'] == 'no_signal':
                    signal_outcome_info = f"⏸️  Last: No signal generated - {outcome.get('reason', 'Market conditions not met')}"
            else:
                signal_outcome_info = "⏸️  No signal activity yet"
            
            from datetime import timezone
            status = f"""
=== Trading Engine Status ===
Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} (Local) | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} (GMT)
Equity: ${account_info.equity:.2f} | Balance: ${account_info.balance:.2f}
Open Positions: {len(open_positions)}
Trading Window: {window_status}
Circuit Breaker: {'HALTED' if cb_state.halted else 'ACTIVE'} {f'({cb_state.reason})' if cb_state.halted else ''}
  - Adjusted Risk: {cb_state.adjusted_risk_percent}% | Confidence Threshold: {cb_state.adjusted_confidence_threshold}%
Recent Signals: {len(recent_signals)} (last 5 cycles)
Trade History: {total_trades} total | Last 5: {recent_wins}W / {recent_losses}L
Last Signal Outcome: {signal_outcome_info}
"""
            logger.info(status)
        
        except Exception as e:
            logger.debug(f"Error displaying status: {e}")
    
    def shutdown(self) -> None:
        """Shutdown system gracefully."""
        logger.info("Shutting down trading engine...")
        self.running = False
        self.mt5_connector.disconnect()
        self.database.close()
        logger.info("Shutdown complete")


def main():
    """Entry point."""
    try:
        # Load configuration
        config_loader = ConfigLoader()
        config_dict = {
            'risk': config_loader.get_risk_parameters(),
            'sessions': config_loader.get_trading_sessions(),
            'circuit_breaker': config_loader.get_circuit_breaker_thresholds(),
            'execution': config_loader.get_execution_settings(),
            'spread': config_loader.get_spread_limits(),
            'atr': config_loader.get_atr_config(),
            'exit': config_loader.get_exit_config(),
            'indicators': config_loader.get_indicator_config(),
            'signals': config_loader.get_signal_config(),
            'database': config_loader.get_database_config(),
            'symbol': config_loader.get_mt5_credentials()['symbol']
        }
        
        # Create and initialize execution loop
        loop = ExecutionLoop(config_dict)
        
        if not loop.initialize_system():
            logger.error("Failed to initialize system")
            sys.exit(1)
        
        # Run main loop
        loop.run()
    
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

