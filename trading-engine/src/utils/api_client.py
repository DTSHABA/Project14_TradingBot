"""
API client for fetching credentials from the server.
"""
import os
import requests
from typing import Dict, Optional, Any
# Try to import logger, but handle if not available
try:
    from ..utils.logger import setup_logger
    logger = setup_logger(__name__)
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


class APIClient:
    """Client for fetching MT5 credentials from the server API."""
    
    def __init__(self, api_url: Optional[str] = None, api_key: Optional[str] = None):
        """
        Initialize API client.
        
        Args:
            api_url: Base URL of the API (defaults to TRADING_ENGINE_API_URL env var)
            api_key: API key for authentication (defaults to TRADING_ENGINE_API_KEY env var)
        """
        self.api_url = api_url or os.getenv('TRADING_ENGINE_API_URL', 'http://localhost:3000')
        self.api_key = api_key or os.getenv('TRADING_ENGINE_API_KEY', 'trading-engine-key')
        
        # Remove trailing slash
        self.api_url = self.api_url.rstrip('/')
    
    def get_mt5_credentials(self, user_id: str, mt5_account_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Fetch MT5 credentials from the server.
        
        Args:
            user_id: User ID
            mt5_account_id: Optional MT5 account ID (if None, fetches active account)
        
        Returns:
            Dictionary with credentials or None if error
        """
        try:
            if mt5_account_id:
                # Fetch specific account credentials
                url = f"{self.api_url}/api/v1/internal/mt5/accounts/{user_id}/{mt5_account_id}/credentials"
            else:
                # Fetch active account credentials
                url = f"{self.api_url}/api/v1/internal/mt5/accounts/{user_id}/active/credentials"
            
            headers = {
                'X-API-Key': self.api_key,
                'Content-Type': 'application/json'
            }
            
            logger.debug(f"Fetching MT5 credentials from {url}")
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Successfully fetched MT5 credentials for user {user_id}, account {data.get('mt5_account_id')}")
                return data
            elif response.status_code == 404:
                logger.warning(f"MT5 account not found: user_id={user_id}, mt5_account_id={mt5_account_id}")
                return None
            else:
                logger.error(f"Failed to fetch MT5 credentials: {response.status_code} - {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching MT5 credentials from API: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching MT5 credentials: {e}", exc_info=True)
            return None

