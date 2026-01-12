"""
Generates comprehensive backtest performance reports.
"""
import csv
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class ResultsReporter:
    """Generates backtest performance reports and exports."""
    
    def __init__(self, results: Dict[str, Any]):
        """
        Initialize results reporter.
        
        Args:
            results: Backtest results dictionary from BacktestRunner
        """
        self.results = results
        self.summary = results.get('summary', {})
        self.trades = results.get('trades', [])
    
    def generate_report(self) -> str:
        """
        Generate comprehensive text report.
        
        Returns:
            Formatted report string
        """
        summary = self.summary
        total_trades = summary.get('total_trades', 0)
        wins = summary.get('wins', 0)
        losses = summary.get('losses', 0)
        win_rate = summary.get('win_rate', 0.0)
        total_pnl = summary.get('total_pnl', 0.0)
        avg_win = summary.get('average_win', 0.0)
        avg_loss = summary.get('average_loss', 0.0)
        profit_factor = summary.get('profit_factor', 0.0)
        avg_hold_time = summary.get('average_hold_time_seconds', 0.0)
        
        starting_equity = self.results.get('starting_equity', 0.0)
        final_equity = self.results.get('final_equity', 0.0)
        total_return = self.results.get('total_return_percent', 0.0)
        max_drawdown = self.results.get('max_drawdown_percent', 0.0)
        total_signals = self.results.get('total_signals', 0)
        
        # Calculate additional metrics
        best_trade = summary.get('best_trade', 0.0)
        worst_trade = summary.get('worst_trade', 0.0)
        
        # Trade distribution by hour
        hour_distribution = self._calculate_hour_distribution()
        
        # Monthly breakdown
        monthly_stats = self._calculate_monthly_stats()
        
        report = f"""
{'='*80}
BACKTEST PERFORMANCE REPORT
{'='*80}

PERIOD: {self._get_period_string()}
STARTING EQUITY: ${starting_equity:,.2f}
FINAL EQUITY: ${final_equity:,.2f}
TOTAL RETURN: {total_return:.2f}%
MAX DRAWDOWN: {max_drawdown:.2f}%

{'='*80}
TRADE STATISTICS
{'='*80}
Total Trades: {total_trades}
Total Signals: {total_signals}
Signal-to-Trade Ratio: {(total_trades/total_signals*100) if total_signals > 0 else 0:.1f}%

Wins: {wins} | Losses: {losses}
Win Rate: {win_rate:.2f}%

Total P&L: ${total_pnl:,.2f}
Average Win: ${avg_win:,.2f}
Average Loss: ${avg_loss:,.2f}
Profit Factor: {profit_factor:.2f}

Best Trade: ${best_trade:,.2f}
Worst Trade: ${worst_trade:,.2f}

Average Hold Time: {avg_hold_time/60:.1f} minutes

{'='*80}
MONTHLY BREAKDOWN
{'='*80}
"""
        for month, stats in monthly_stats.items():
            report += f"""
{month}:
  Trades: {stats['trades']}
  Win Rate: {stats['win_rate']:.1f}%
  P&L: ${stats['pnl']:,.2f}
"""
        
        report += f"""
{'='*80}
TRADE DISTRIBUTION BY HOUR (GMT)
{'='*80}
"""
        for hour in sorted(hour_distribution.keys()):
            stats = hour_distribution[hour]
            report += f"Hour {hour:02d}:00 - {stats['trades']} trades, {stats['win_rate']:.1f}% win rate, ${stats['pnl']:,.2f} P&L\n"
        
        report += f"""
{'='*80}
END OF REPORT
{'='*80}
"""
        
        return report
    
    def export_to_csv(self, filepath: str) -> None:
        """
        Export all trades to CSV file.
        
        Args:
            filepath: Path to CSV file
        """
        if not self.trades:
            logger.warning("No trades to export")
            return
        
        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        with open(filepath, 'w', newline='') as csvfile:
            fieldnames = [
                'ticket', 'symbol', 'direction', 'entry_price', 'exit_price',
                'lot_size', 'stop_loss', 'take_profit', 'entry_time', 'exit_time',
                'pnl', 'exit_reason', 'hold_time_seconds'
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for trade in self.trades:
                row = {
                    'ticket': trade.get('ticket'),
                    'symbol': trade.get('symbol'),
                    'direction': trade.get('direction'),
                    'entry_price': trade.get('entry_price'),
                    'exit_price': trade.get('exit_price'),
                    'lot_size': trade.get('lot_size'),
                    'stop_loss': trade.get('stop_loss'),
                    'take_profit': trade.get('take_profit'),
                    'entry_time': trade.get('entry_time'),
                    'exit_time': trade.get('exit_time'),
                    'pnl': trade.get('pnl'),
                    'exit_reason': trade.get('exit_reason'),
                    'hold_time_seconds': trade.get('hold_time_seconds')
                }
                writer.writerow(row)
        
        logger.info(f"Exported {len(self.trades)} trades to {filepath}")
    
    def export_summary_to_json(self, filepath: str) -> None:
        """
        Export summary statistics to JSON file.
        
        Args:
            filepath: Path to JSON file
        """
        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        export_data = {
            'summary': self.summary,
            'starting_equity': self.results.get('starting_equity'),
            'final_equity': self.results.get('final_equity'),
            'total_return_percent': self.results.get('total_return_percent'),
            'max_drawdown_percent': self.results.get('max_drawdown_percent'),
            'total_trades': len(self.trades),
            'total_signals': self.results.get('total_signals'),
            'hour_distribution': self._calculate_hour_distribution(),
            'monthly_stats': self._calculate_monthly_stats()
        }
        
        with open(filepath, 'w') as f:
            json.dump(export_data, f, indent=2, default=str)
        
        logger.info(f"Exported summary to {filepath}")
    
    def _calculate_hour_distribution(self) -> Dict[int, Dict[str, Any]]:
        """Calculate trade distribution by hour."""
        hour_stats = {}
        
        for trade in self.trades:
            entry_time = trade.get('entry_time')
            if isinstance(entry_time, str):
                try:
                    entry_time = datetime.fromisoformat(entry_time.replace('Z', '+00:00'))
                except:
                    continue
            
            if not isinstance(entry_time, datetime):
                continue
            
            hour = entry_time.hour
            if hour not in hour_stats:
                hour_stats[hour] = {'trades': 0, 'wins': 0, 'losses': 0, 'pnl': 0.0}
            
            hour_stats[hour]['trades'] += 1
            pnl = trade.get('pnl', 0)
            hour_stats[hour]['pnl'] += pnl
            
            if pnl > 0:
                hour_stats[hour]['wins'] += 1
            elif pnl < 0:
                hour_stats[hour]['losses'] += 1
        
        # Calculate win rates
        for hour in hour_stats:
            stats = hour_stats[hour]
            total = stats['trades']
            stats['win_rate'] = (stats['wins'] / total * 100) if total > 0 else 0.0
        
        return hour_stats
    
    def _calculate_monthly_stats(self) -> Dict[str, Dict[str, Any]]:
        """Calculate monthly statistics."""
        monthly_stats = {}
        
        for trade in self.trades:
            entry_time = trade.get('entry_time')
            if isinstance(entry_time, str):
                try:
                    entry_time = datetime.fromisoformat(entry_time.replace('Z', '+00:00'))
                except:
                    continue
            
            if not isinstance(entry_time, datetime):
                continue
            
            month_key = entry_time.strftime('%Y-%m')
            if month_key not in monthly_stats:
                monthly_stats[month_key] = {'trades': 0, 'wins': 0, 'losses': 0, 'pnl': 0.0}
            
            monthly_stats[month_key]['trades'] += 1
            pnl = trade.get('pnl', 0)
            monthly_stats[month_key]['pnl'] += pnl
            
            if pnl > 0:
                monthly_stats[month_key]['wins'] += 1
            elif pnl < 0:
                monthly_stats[month_key]['losses'] += 1
        
        # Calculate win rates
        for month in monthly_stats:
            stats = monthly_stats[month]
            total = stats['trades']
            stats['win_rate'] = (stats['wins'] / total * 100) if total > 0 else 0.0
        
        return monthly_stats
    
    def _get_period_string(self) -> str:
        """Get period string from backtest dates or trades."""
        # First try to use the actual backtest date range
        start_date = self.results.get('start_date')
        end_date = self.results.get('end_date')
        
        if start_date and end_date:
            if isinstance(start_date, str):
                start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            if isinstance(end_date, str):
                end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            return f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}"
        
        # Fallback to inferring from trades
        if not self.trades:
            return "N/A"
        
        entry_times = []
        for trade in self.trades:
            entry_time = trade.get('entry_time')
            if isinstance(entry_time, str):
                try:
                    entry_time = datetime.fromisoformat(entry_time.replace('Z', '+00:00'))
                except:
                    continue
            if isinstance(entry_time, datetime):
                entry_times.append(entry_time)
        
        if not entry_times:
            return "N/A"
        
        start = min(entry_times)
        end = max(entry_times)
        return f"{start.strftime('%Y-%m-%d')} to {end.strftime('%Y-%m-%d')}"

