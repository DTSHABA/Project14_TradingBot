"""
Configuration loader with YAML, environment variable, and API support.
"""
import os
import yaml
from pathlib import Path
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv


class ConfigLoader:
    """Loads and manages configuration from YAML and environment variables."""
    
    def __init__(self, config_path: str = "config/config.yaml"):
        """
        Initialize config loader.
        
        Args:
            config_path: Path to YAML config file
        """
        self.config_path = Path(config_path)
        self.config: Dict[str, Any] = {}
        # Load .env file - try current directory and parent directories
        env_loaded = load_dotenv()
        if not env_loaded:
            # Try loading from trading-engine directory explicitly
            trading_engine_dir = Path(__file__).parent.parent
            env_path = trading_engine_dir / '.env'
            if env_path.exists():
                load_dotenv(env_path)
        self._load_config()
    
    def _load_config(self) -> None:
        """Load configuration from YAML file."""
        if not self.config_path.exists():
            raise FileNotFoundError(f"Config file not found: {self.config_path}")
        
        with open(self.config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f) or {}
    
    def get_mt5_credentials(self) -> Dict[str, str]:
        """
        Get MT5 login credentials from API or environment variables.
        
        Priority:
        1. API (if TRADING_ENGINE_API_URL and user_id/mt5_account_id are set)
        2. Environment variables
        
        Returns:
            Dictionary with login, password, server, symbol, and path
        """
        # Try API first if configured
        api_url = os.getenv('TRADING_ENGINE_API_URL')
        user_id = os.getenv('TRADING_ENGINE_USER_ID')
        mt5_account_id = os.getenv('TRADING_ENGINE_MT5_ACCOUNT_ID')
        
        if api_url and user_id:
            try:
                import sys
                from pathlib import Path
                # Add src to path if not already there
                src_path = Path(__file__).parent.parent / 'src'
                if str(src_path) not in sys.path:
                    sys.path.insert(0, str(src_path))
                from utils.api_client import APIClient
                api_client = APIClient()
                credentials = api_client.get_mt5_credentials(user_id, mt5_account_id)
                
                if credentials:
                    return {
                        'login': credentials.get('account_number', ''),
                        'password': credentials.get('password', ''),
                        'server': credentials.get('server', ''),
                        'symbol': os.getenv('MT5_SYMBOL', 'XAUUSD'),
                        'path': os.getenv('MT5_PATH', '')
                    }
            except Exception as e:
                import logging
                logging.warning(f"Failed to fetch credentials from API, falling back to env vars: {e}")
        
        # Fallback to environment variables
        return {
            'login': os.getenv('MT5_LOGIN', ''),
            'password': os.getenv('MT5_PASSWORD', ''),
            'server': os.getenv('MT5_SERVER', ''),
            'symbol': os.getenv('MT5_SYMBOL', 'XAUUSD'),
            'path': os.getenv('MT5_PATH', '')
        }
    
    def get_risk_parameters(self) -> Dict[str, Any]:
        """
        Get risk management parameters.
        
        Returns:
            Dictionary with risk parameters
        """
        return self.config.get('risk', {})
    
    def get_trading_sessions(self) -> Dict[str, Any]:
        """
        Get trading session configuration.
        
        Returns:
            Dictionary with session windows and risk multipliers
        """
        return self.config.get('sessions', {})
    
    def get_circuit_breaker_thresholds(self) -> Dict[str, Any]:
        """
        Get circuit breaker configuration.
        
        Returns:
            Dictionary with circuit breaker thresholds
        """
        return self.config.get('circuit_breaker', {})
    
    def get_execution_settings(self) -> Dict[str, Any]:
        """
        Get execution settings.
        
        Returns:
            Dictionary with execution parameters
        """
        return self.config.get('execution', {})
    
    def get_spread_limits(self) -> Dict[str, float]:
        """
        Get spread limits.
        
        Returns:
            Dictionary with spread limits by session type
        """
        return self.config.get('spread', {})
    
    def get_atr_config(self) -> Dict[str, Any]:
        """
        Get ATR filtering configuration.
        
        Returns:
            Dictionary with ATR parameters
        """
        return self.config.get('atr', {})
    
    def get_exit_config(self) -> Dict[str, Any]:
        """
        Get exit strategy configuration.
        
        Returns:
            Dictionary with exit parameters
        """
        return self.config.get('exit', {})
    
    def get_indicator_config(self) -> Dict[str, int]:
        """
        Get indicator configuration.
        
        Returns:
            Dictionary with indicator periods
        """
        return self.config.get('indicators', {})
    
    def get_signal_config(self) -> Dict[str, Any]:
        """
        Get signal generation configuration.
        
        Returns:
            Dictionary with signal parameters
        """
        return self.config.get('signals', {})
    
    def get_logging_config(self) -> Dict[str, Any]:
        """
        Get logging configuration.
        
        Returns:
            Dictionary with logging parameters
        """
        return self.config.get('logging', {})
    
    def get_database_config(self) -> Dict[str, Any]:
        """
        Get database configuration from YAML, environment variables, or API.
        
        Returns:
            Dictionary with database parameters
        """
        db_config = self.config.get('database', {}).copy()
        
        # Get user_id and mt5_account_id from env vars (required)
        user_id = os.getenv('TRADING_ENGINE_USER_ID')
        mt5_account_id = os.getenv('TRADING_ENGINE_MT5_ACCOUNT_ID')
        
        # If using API mode, try to fetch mt5_account_id if not provided
        api_url = os.getenv('TRADING_ENGINE_API_URL')
        if api_url and user_id and not mt5_account_id:
            try:
                import sys
                from pathlib import Path
                # Add src to path if not already there
                src_path = Path(__file__).parent.parent / 'src'
                if str(src_path) not in sys.path:
                    sys.path.insert(0, str(src_path))
                from utils.api_client import APIClient
                api_client = APIClient()
                credentials = api_client.get_mt5_credentials(user_id, None)  # Get active account
                if credentials:
                    mt5_account_id = credentials.get('mt5_account_id')
            except Exception as e:
                import logging
                logging.warning(f"Failed to fetch mt5_account_id from API: {e}")
        
        # Set user_id and mt5_account_id
        if user_id:
            db_config['user_id'] = user_id
        if mt5_account_id:
            db_config['mt5_account_id'] = mt5_account_id
        
        # Database connection string
        if os.getenv('DATABASE_URL'):
            db_config['connection_string'] = os.getenv('DATABASE_URL')
        elif os.getenv('POSTGRES_URL'):
            db_config['connection_string'] = os.getenv('POSTGRES_URL')
        
        return db_config
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get configuration value by key path (supports dot notation).
        
        Args:
            key: Configuration key (e.g., 'risk.risk_per_trade')
            default: Default value if key not found
        
        Returns:
            Configuration value
        """
        keys = key.split('.')
        value = self.config
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
                if value is None:
                    return default
            else:
                return default
        return value

