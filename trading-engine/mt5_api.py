"""
MT5 Connection API Service
A simple HTTP API for testing MT5 connections from the Node.js server
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
import signal
from threading import Timer
import subprocess
import platform

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.market_data.mt5_connector import MT5Connector
from src.utils.logger import setup_logger

logger = setup_logger(__name__)
app = Flask(__name__)
CORS(app)  # Enable CORS for Node.js server

# Connection timeout in seconds
CONNECTION_TIMEOUT = 25

# Store connector instance (reuse across requests for efficiency)
mt5_connector = None

def check_mt5_process_running():
    """
    Check if MetaTrader 5 terminal process is running on Windows.
    Returns True if MT5 terminal process is found, False otherwise.
    """
    if platform.system() != 'Windows':
        # On non-Windows systems, we can't easily check, so assume it might be running
        return None
    
    try:
        # Check for common MT5 process names
        mt5_processes = ['terminal64.exe', 'terminal.exe', 'metatrader5.exe']
        result = subprocess.run(
            ['tasklist', '/FI', 'IMAGENAME eq terminal64.exe', '/NH'],
            capture_output=True,
            text=True,
            timeout=2
        )
        
        # Also check for terminal.exe
        result2 = subprocess.run(
            ['tasklist', '/FI', 'IMAGENAME eq terminal.exe', '/NH'],
            capture_output=True,
            text=True,
            timeout=2
        )
        
        # If either process is found, MT5 is running
        return (
            'terminal64.exe' in result.stdout or 
            'terminal.exe' in result2.stdout
        )
    except Exception as e:
        logger.warning(f"Could not check MT5 process status: {e}")
        return None  # Unknown status

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    # Quick check if MT5 terminal might be running
    mt5_running = check_mt5_process_running()
    
    response = {
        'status': 'healthy',
        'service': 'mt5-api',
        'version': '1.0.0',
        'mt5_terminal_detected': mt5_running if mt5_running is not None else 'unknown'
    }
    
    return jsonify(response)

@app.route('/mt5/test-connection', methods=['POST'])
def test_connection():
    """
    Test MT5 connection with provided credentials
    
    Expected JSON body:
    {
        "account_number": "10008463761",
        "password": "your_password",
        "server": "MetaQuotes-Demo",
        "path": "C:/Program Files/MetaTrader 5/terminal64.exe" (optional)
    }
    
    Returns:
    {
        "connected": true/false,
        "account_info": {
            "equity": 10000.0,
            "balance": 10000.0,
            "margin": 0.0,
            "free_margin": 10000.0,
            "margin_level": 0.0,
            "currency": "USD"
        },
        "error": "error message" (if failed)
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data:
            return jsonify({
                'connected': False,
                'error': 'No data provided'
            }), 400
        
        account_number = data.get('account_number')
        password = data.get('password')
        server = data.get('server')
        path = data.get('path')  # Optional MT5 terminal path
        
        # Use default path if not provided (common Windows installation)
        if not path:
            default_paths = [
                r'C:\Program Files\MetaTrader\terminal64.exe',
                r'C:\Program Files\MetaTrader 5\terminal64.exe',
            ]
            for default_path in default_paths:
                from pathlib import Path
                if Path(default_path).exists():
                    path = default_path
                    logger.info(f"Using default MT5 path: {path}")
                    break
        
        # Log connection attempt details (without password)
        logger.info(f"Connection attempt - Account: {account_number}, Server: {server}, Path: {path or 'auto-detect'}")
        
        if not account_number or not password or not server:
            return jsonify({
                'connected': False,
                'error': 'account_number, password, and server are required'
            }), 400
        
        # Convert account number to integer
        try:
            login = int(account_number)
        except ValueError:
            return jsonify({
                'connected': False,
                'error': 'account_number must be numeric'
            }), 400
        
        # Create new connector for each test (ensures clean state)
        connector = MT5Connector()
        
        # Attempt connection
        logger.info(f"Testing connection to MT5 account {login} on server {server}")
        
        try:
            # Check if MT5 terminal path exists if provided
            if path:
                from pathlib import Path
                if not Path(path).exists():
                    logger.warning(f"MT5 path does not exist: {path}, trying auto-detection")
                    path = None
            
            # Quick check: Try to import and initialize MT5 to see if it's available
            import MetaTrader5 as mt5
            
            # Pre-check: See if MT5 terminal process is running (Windows only)
            mt5_running = check_mt5_process_running()
            if mt5_running is False:
                logger.warning("MT5 terminal process not detected. User may need to open MT5 terminal first.")
            
            logger.info("Attempting MT5 initialization...")
            
            # Try initialization first (this can hang if MT5 isn't installed)
            initialized = mt5.initialize(path=path) if path else mt5.initialize()
            
            if not initialized:
                error = mt5.last_error()
                error_code = error[0] if isinstance(error, tuple) else None
                error_description = error[1] if isinstance(error, tuple) and len(error) > 1 else str(error)
                
                logger.error(f"MT5 initialization failed: {error}")
                
                # Handle specific error codes
                if error_code == -10005:  # IPC timeout
                    if mt5_running is False:
                        error_msg = (
                            'MetaTrader 5 terminal is not running. '
                            'Please:\n'
                            '1. Open MetaTrader 5 terminal manually\n'
                            '2. Log in to your account in the terminal\n'
                            '3. Keep the terminal window open\n'
                            '4. Try the connection again'
                        )
                    else:
                        error_msg = (
                            'MetaTrader 5 terminal is not responding (IPC timeout). '
                            'Please:\n'
                            '1. Ensure MetaTrader 5 terminal is installed\n'
                            '2. Open MetaTrader 5 terminal manually\n'
                            '3. Log in to your account in the terminal\n'
                            '4. Keep the terminal window open\n'
                            '5. Restart the MT5 API service if the issue persists\n'
                            '6. Try the connection again'
                        )
                elif error_code == -10001:  # Common error (often means terminal not found)
                    error_msg = (
                        'MetaTrader 5 terminal not found. '
                        'Please install MetaTrader 5 from https://www.metatrader5.com/ '
                        'or provide the correct MT5 terminal path.'
                    )
                else:
                    error_msg = (
                        f'MetaTrader 5 initialization failed. '
                        f'Error: {error_description} (Code: {error_code}). '
                        'Please ensure MetaTrader 5 terminal is installed and running.'
                    )
                
                return jsonify({
                    'connected': False,
                    'error': error_msg
                }), 400
            
            logger.info("MT5 initialized successfully, attempting login...")
            
            connected = connector.connect(login, password, server, path)
            
            if not connected:
                connector.disconnect()
                # Get more detailed error from MT5
                import MetaTrader5 as mt5
                mt5_error = mt5.last_error()
                
                # Format error message based on error code
                error_code = mt5_error[0] if isinstance(mt5_error, tuple) else None
                error_description = mt5_error[1] if isinstance(mt5_error, tuple) and len(mt5_error) > 1 else str(mt5_error)
                
                # Common MT5 error codes and user-friendly messages
                error_messages = {
                    -10005: "IPC timeout - MetaTrader 5 terminal is not running. Please open MT5 terminal and log in, then try again.",
                    -10004: "Invalid account or password",
                    -10003: "Invalid server name",
                    -10002: "Connection failed - check your internet connection",
                    -10001: "Common error - verify credentials or ensure MT5 terminal is running",
                    1: "Login failed - check account number, password, and server name. Error code 1 may indicate successful initialization but failed authentication.",
                }
                
                # If error code is 1, it's likely a login failure (not initialization)
                if error_code == 1:
                    user_message = error_messages.get(1, "Authentication failed - verify your account number, password, and server name match exactly what's in your MT5 terminal")
                else:
                    user_message = error_messages.get(error_code, error_description)
                
                error_msg = f'MT5 Authentication failed: {user_message}'
                if error_code:
                    error_msg += f' (Error code: {error_code})'
                
                logger.error(f"MT5 connection failed: {mt5_error}")
                logger.error(f"Account: {login}, Server: {server}")
                
                return jsonify({
                    'connected': False,
                    'error': error_msg
                })
        except Exception as e:
            logger.error(f"Exception during MT5 connection: {str(e)}", exc_info=True)
            connector.disconnect()
            return jsonify({
                'connected': False,
                'error': f'MT5 connection error: {str(e)}. Please ensure MetaTrader 5 terminal is installed.'
            }), 500
        
        # Get account info
        account_info = connector.get_account_info()
        
        # Disconnect after test
        connector.disconnect()
        
        if account_info is None:
            return jsonify({
                'connected': False,
                'error': 'Connected but failed to retrieve account information'
            })
        
        # Success response
        return jsonify({
            'connected': True,
            'account_info': {
                'equity': account_info.equity,
                'balance': account_info.balance,
                'margin': account_info.margin,
                'free_margin': account_info.free_margin,
                'margin_level': account_info.margin_level,
                'currency': account_info.currency
            }
        })
        
    except Exception as e:
        logger.error(f"Error testing MT5 connection: {str(e)}", exc_info=True)
        return jsonify({
            'connected': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

@app.route('/mt5/connect', methods=['POST'])
def connect():
    """
    Establish persistent MT5 connection
    Similar to test-connection but maintains the connection
    """
    global mt5_connector
    
    try:
        data = request.get_json()
        
        account_number = data.get('account_number')
        password = data.get('password')
        server = data.get('server')
        path = data.get('path')
        
        if not account_number or not password or not server:
            return jsonify({
                'success': False,
                'error': 'account_number, password, and server are required'
            }), 400
        
        login = int(account_number)
        
        # Disconnect existing connection if any
        if mt5_connector and mt5_connector.is_connected():
            mt5_connector.disconnect()
        
        # Create new connector
        mt5_connector = MT5Connector()
        connected = mt5_connector.connect(login, password, server, path)
        
        if not connected:
            mt5_connector = None
            return jsonify({
                'success': False,
                'error': 'Failed to connect to MT5'
            })
        
        account_info = mt5_connector.get_account_info()
        
        return jsonify({
            'success': True,
            'connected': True,
            'account_info': {
                'equity': account_info.equity,
                'balance': account_info.balance,
                'margin': account_info.margin,
                'free_margin': account_info.free_margin,
                'currency': account_info.currency
            } if account_info else None
        })
        
    except Exception as e:
        logger.error(f"Error connecting to MT5: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/mt5/disconnect', methods=['POST'])
def disconnect():
    """Disconnect from MT5"""
    global mt5_connector
    
    try:
        if mt5_connector:
            mt5_connector.disconnect()
            mt5_connector = None
        
        return jsonify({
            'success': True,
            'message': 'Disconnected from MT5'
        })
        
    except Exception as e:
        logger.error(f"Error disconnecting from MT5: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/mt5/status', methods=['GET'])
def status():
    """Check MT5 connection status"""
    global mt5_connector
    
    connected = mt5_connector and mt5_connector.is_connected()
    
    if not connected:
        return jsonify({
            'connected': False
        })
    
    account_info = mt5_connector.get_account_info()
    
    return jsonify({
        'connected': True,
        'account_info': {
            'equity': account_info.equity,
            'balance': account_info.balance,
            'margin': account_info.margin,
            'free_margin': account_info.free_margin,
            'currency': account_info.currency
        } if account_info else None
    })

def main():
    """Run the MT5 API service"""
    port = int(os.getenv('MT5_API_PORT', 5001))
    host = os.getenv('MT5_API_HOST', '127.0.0.1')
    debug = os.getenv('DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting MT5 API service on {host}:{port}")
    logger.info(f"Health check: http://{host}:{port}/health")
    logger.info(f"Test endpoint: http://{host}:{port}/mt5/test-connection")
    
    app.run(host=host, port=port, debug=debug)

if __name__ == '__main__':
    main()

