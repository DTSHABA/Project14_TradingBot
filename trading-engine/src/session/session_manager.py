"""
Time-based trading windows and session management (Local Time).
"""
from typing import Dict, List, Any, Optional
from datetime import datetime, time, timedelta
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class SessionManager:
    """Manages trading sessions based on local time windows."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize session manager.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.sessions_config = config.get('sessions', {})
        self.prime_windows = self.sessions_config.get('prime', [])
        self.acceptable_windows = self.sessions_config.get('acceptable', [])
        self.risk_multipliers = self.sessions_config.get('risk_multiplier', {})
    
    def is_trading_window(self, current_time_local: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Check if current time is in trading window.
        
        Args:
            current_time_local: Current local time (default: now)
        
        Returns:
            Dictionary with 'active', 'session_type', 'risk_multiplier'
        """
        if current_time_local is None:
            current_time_local = datetime.now()  # Use local time
        
        current_time = current_time_local.time()
        current_weekday = current_time_local.weekday()  # 0=Monday, 4=Friday
        
        # TEMPORARY: Disabled Friday restriction for testing
        # Check if Friday after 16:00 Local Time (closed)
        # if current_weekday == 4 and current_time >= time(16, 0):
        #     return {
        #         'active': False,
        #         'session_type': 'closed',
        #         'risk_multiplier': 0.0,
        #         'reason': 'Friday after 16:00 Local Time'
        #     }
        
        # Check prime sessions
        for window in self.prime_windows:
            if not window.get('enabled', True):
                continue
            
            start_str = window.get('start', '')
            end_str = window.get('end', '')
            
            if self._time_in_window(current_time, start_str, end_str):
                return {
                    'active': True,
                    'session_type': 'prime',
                    'risk_multiplier': self.risk_multipliers.get('prime', 1.0),
                    'reason': f'Prime session: {start_str}-{end_str} Local Time'
                }
        
        # Check acceptable sessions
        for window in self.acceptable_windows:
            if not window.get('enabled', True):
                continue
            
            start_str = window.get('start', '')
            end_str = window.get('end', '')
            
            if self._time_in_window(current_time, start_str, end_str):
                return {
                    'active': True,
                    'session_type': 'acceptable',
                    'risk_multiplier': self.risk_multipliers.get('acceptable', 0.75),
                    'reason': f'Acceptable session: {start_str}-{end_str} Local Time'
                }
        
        # TEMPORARY: Disabled early morning restriction for testing
        # Check if in closed hours (00:00-07:00) - Only early morning restriction
        # Note: 18:00-24:00 restriction removed to allow test windows
        # if current_time < time(7, 0):
        #     return {
        #         'active': False,
        #         'session_type': 'closed',
        #         'risk_multiplier': 0.0,
        #         'reason': 'Outside trading hours (early morning)'
        #     }
        
        # Default: closed (no active window configured)
        return {
            'active': False,
            'session_type': 'closed',
            'risk_multiplier': 0.0,
            'reason': 'No active trading window'
        }
    
    def _time_in_window(self, current_time: time, start_str: str, end_str: str) -> bool:
        """
        Check if current time is within window.
        
        Args:
            current_time: Current time
            start_str: Start time string (HH:MM)
            end_str: End time string (HH:MM)
        
        Returns:
            True if in window
        """
        try:
            start_parts = start_str.split(':')
            end_parts = end_str.split(':')
            
            start_time = time(int(start_parts[0]), int(start_parts[1]))
            end_time = time(int(end_parts[0]), int(end_parts[1]))
            
            if start_time <= end_time:
                # Normal window (same day)
                return start_time <= current_time < end_time
            else:
                # Window spans midnight
                return current_time >= start_time or current_time < end_time
        except (ValueError, IndexError):
            logger.warning(f"Invalid time window format: {start_str}-{end_str}")
            return False
    
    def get_session_type(self, current_time: Optional[datetime] = None) -> str:
        """
        Get current session type.
        
        Args:
            current_time: Current local time (default: now)
        
        Returns:
            'prime', 'acceptable', or 'closed'
        """
        window_info = self.is_trading_window(current_time)
        return window_info['session_type']
    
    def get_risk_multiplier(self, session_type: Optional[str] = None) -> float:
        """
        Get risk multiplier for session type.
        
        Args:
            session_type: Session type (default: current session)
        
        Returns:
            Risk multiplier (0.0-1.0)
        """
        if session_type is None:
            window_info = self.is_trading_window()
            session_type = window_info['session_type']
        
        return self.risk_multipliers.get(session_type, 0.0)
    
    def get_next_window(self) -> Optional[Dict[str, Any]]:
        """
        Get next trading window start time.
        
        Returns:
            Dictionary with next window info or None
        """
        current_time = datetime.now()  # Use local time
        current_date = current_time.date()
        
        # Collect all windows
        all_windows = []
        for window in self.prime_windows:
            if window.get('enabled', True):
                all_windows.append({
                    'start': window['start'],
                    'end': window['end'],
                    'type': 'prime'
                })
        
        for window in self.acceptable_windows:
            if window.get('enabled', True):
                all_windows.append({
                    'start': window['start'],
                    'end': window['end'],
                    'type': 'acceptable'
                })
        
        # Sort windows by start time
        all_windows.sort(key=lambda w: w['start'])
        
        # Find next window
        for window in all_windows:
            start_parts = window['start'].split(':')
            window_start = datetime.combine(current_date, time(int(start_parts[0]), int(start_parts[1])))
            
            if window_start > current_time:
                return {
                    'start_time': window_start,
                    'type': window['type'],
                    'start': window['start'],
                    'end': window['end']
                }
        
        # If no window today, return first window tomorrow
        if all_windows:
            first_window = all_windows[0]
            start_parts = first_window['start'].split(':')
            next_date = current_date + timedelta(days=1)
            window_start = datetime.combine(next_date, time(int(start_parts[0]), int(start_parts[1])))
            
            return {
                'start_time': window_start,
                'type': first_window['type'],
                'start': first_window['start'],
                'end': first_window['end']
            }
        
        return None

