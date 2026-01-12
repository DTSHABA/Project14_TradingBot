"""
Backtesting script for trading engine.
"""
import sys
import argparse
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config.config_loader import ConfigLoader
from src.utils.logger import setup_logger
from src.market_data.mt5_connector import MT5Connector
from src.backtesting.backtest_runner import BacktestRunner
from src.backtesting.results_reporter import ResultsReporter

logger = setup_logger(__name__)


def main():
    """Main entry point for backtesting."""
    parser = argparse.ArgumentParser(description='Run backtest for trading engine')
    parser.add_argument('--start', type=str, default='2024-06-01',
                       help='Start date (YYYY-MM-DD), default: 2024-06-01')
    parser.add_argument('--end', type=str, default='2024-08-31',
                       help='End date (YYYY-MM-DD), default: 2024-08-31')
    parser.add_argument('--equity', type=float, default=10000.0,
                       help='Initial equity, default: 10000.0')
    parser.add_argument('--output-dir', type=str, default='backtest_results',
                       help='Output directory for reports, default: backtest_results')
    parser.add_argument('--no-csv', action='store_true',
                       help='Skip CSV export')
    parser.add_argument('--no-json', action='store_true',
                       help='Skip JSON export')
    
    args = parser.parse_args()
    
    # Parse dates and make them timezone-aware (UTC)
    from datetime import timezone
    try:
        start_date = datetime.strptime(args.start, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        end_date = datetime.strptime(args.end, '%Y-%m-%d').replace(tzinfo=timezone.utc)
    except ValueError as e:
        logger.error(f"Invalid date format: {e}")
        logger.error("Use YYYY-MM-DD format (e.g., 2024-06-01)")
        sys.exit(1)
    
    if start_date >= end_date:
        logger.error("Start date must be before end date")
        sys.exit(1)
    
    logger.info(f"Backtest Configuration:")
    logger.info(f"  Period: {start_date.date()} to {end_date.date()}")
    logger.info(f"  Initial Equity: ${args.equity:,.2f}")
    logger.info(f"  Output Directory: {args.output_dir}")
    
    # Load configuration
    try:
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
            'symbol': config_loader.get_mt5_credentials().get('symbol', 'XAUUSD')
        }
    except Exception as e:
        logger.error(f"Failed to load configuration: {e}", exc_info=True)
        sys.exit(1)
    
    # Initialize MT5 connection (needed for fetching historical data)
    mt5_connector = MT5Connector()
    try:
        mt5_creds = config_loader.get_mt5_credentials()
        if not mt5_connector.connect(
            int(mt5_creds['login']),
            mt5_creds['password'],
            mt5_creds['server'],
            mt5_creds.get('path', None)
        ):
            logger.error("Failed to connect to MT5. Historical data fetching requires MT5 connection.")
            sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to connect to MT5: {e}", exc_info=True)
        sys.exit(1)
    
    # Initialize backtest runner
    try:
        runner = BacktestRunner(config_dict, mt5_connector)
    except Exception as e:
        logger.error(f"Failed to initialize backtest runner: {e}", exc_info=True)
        mt5_connector.disconnect()
        sys.exit(1)
    
    # Run backtest
    try:
        logger.info("Starting backtest...")
        results = runner.run_backtest(start_date, end_date, args.equity)
        
        if 'error' in results:
            logger.error(f"Backtest failed: {results['error']}")
            mt5_connector.disconnect()
            sys.exit(1)
        
        # Generate report
        reporter = ResultsReporter(results)
        report_text = reporter.generate_report()
        
        # Print report
        print(report_text)
        
        # Export results
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Save text report
        report_file = output_dir / f'backtest_report_{timestamp}.txt'
        with open(report_file, 'w') as f:
            f.write(report_text)
        logger.info(f"Report saved to {report_file}")
        
        # Export CSV
        if not args.no_csv:
            csv_file = output_dir / f'backtest_trades_{timestamp}.csv'
            reporter.export_to_csv(str(csv_file))
        
        # Export JSON
        if not args.no_json:
            json_file = output_dir / f'backtest_summary_{timestamp}.json'
            reporter.export_summary_to_json(str(json_file))
        
        # Summary
        summary = results.get('summary', {})
        total_trades = summary.get('total_trades', 0)
        logger.info(f"\nBacktest complete!")
        logger.info(f"Total trades: {total_trades}")
        logger.info(f"Results saved to {output_dir}")
        
        if total_trades < 1500:
            logger.warning(f"Only {total_trades} trades generated. Target was 1500+.")
            logger.warning("Consider relaxing signal generation parameters if needed.")
        
    except KeyboardInterrupt:
        logger.info("Backtest interrupted by user")
        mt5_connector.disconnect()
        sys.exit(1)
    except Exception as e:
        logger.error(f"Error during backtest: {e}", exc_info=True)
        mt5_connector.disconnect()
        sys.exit(1)
    finally:
        mt5_connector.disconnect()


if __name__ == "__main__":
    main()

