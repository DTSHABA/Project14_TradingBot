/**
 * MT5 Connection Test
 * 
 * This module provides functionality to test MT5 connections.
 * It connects to a Python service that interfaces with MetaTrader5.
 */

export interface MT5AccountInfo {
  equity: number;
  balance: number;
  margin?: number;
  margin_free?: number;
  margin_level?: number;
  currency?: string;
}

export interface MT5ConnectionResult {
  connected: boolean;
  account_info?: MT5AccountInfo;
  error?: string;
}

/**
 * Get MT5 API URL from environment or use default
 */
function getMT5ApiUrl(): string {
  return process.env.MT5_API_URL || 'http://127.0.0.1:5001';
}

/**
 * Test MT5 connection
 * 
 * This function attempts to connect to MT5 using the provided credentials
 * by calling the Python MT5 API service.
 * 
 * @param account_number - MT5 account number
 * @param password - MT5 password
 * @param server - MT5 server name (e.g., "MetaQuotes-Demo")
 * @param path - Optional path to MT5 terminal executable
 * @returns Promise<MT5ConnectionResult>
 */
export async function testMT5Connection(
  account_number: string,
  password: string,
  server: string,
  path?: string
): Promise<MT5ConnectionResult> {
  const apiUrl = getMT5ApiUrl();
  
  try {
    // First check if the MT5 API service is running
    let healthCheckPassed = false;
    try {
      const healthResponse = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout for health check
      });
      
      if (!healthResponse.ok) {
        return {
          connected: false,
          error: 'MT5 API service is not responding. Please start the MT5 API service by running: trading-engine/run_mt5_api.bat',
        };
      }
      healthCheckPassed = true;
    } catch (healthError) {
      // Distinguish between timeout and other errors
      if (healthError instanceof Error && healthError.name === 'AbortError') {
        return {
          connected: false,
          error: 'MT5 API service health check timed out. The service may be slow to respond or not running. Please ensure the MT5 API service is running by executing: trading-engine/run_mt5_api.bat',
        };
      }
      return {
        connected: false,
        error: 'MT5 API service is not running. Please start it by running: trading-engine/run_mt5_api.bat',
      };
    }
    
    // Call the Python MT5 API to test connection
    // Increased timeout to 30 seconds as MT5 connection can take time
    try {
      const response = await fetch(`${apiUrl}/mt5/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_number,
          password,
          server,
          path: path || process.env.MT5_TERMINAL_PATH || 'C:\\Program Files\\MetaTrader\\terminal64.exe',
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout for actual connection test
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return {
          connected: false,
          error: data.error || 'Failed to test MT5 connection',
        };
      }
      
      return {
        connected: data.connected,
        account_info: data.account_info,
        error: data.error,
      };
    } catch (connectionError) {
      // Handle connection test specific errors
      if (connectionError instanceof Error) {
        // Check for timeout/abort errors first
        if (connectionError.name === 'AbortError' || connectionError.message.includes('timeout') || connectionError.message.includes('aborted')) {
          return {
            connected: false,
            error: 'MT5 connection test timed out after 30 seconds. This may indicate:\n- MT5 terminal is not running (open MT5 terminal and log in first)\n- Incorrect credentials or server name\n- Network connectivity issues\n- MT5 terminal is not installed or accessible\n\nPlease:\n1. Open MetaTrader 5 terminal manually\n2. Log in to your account\n3. Keep the terminal open\n4. Try the connection again',
          };
        }
        
        // Network errors
        if (connectionError.message.includes('fetch') || connectionError.message.includes('network') || connectionError.message.includes('ECONNREFUSED')) {
          return {
            connected: false,
            error: 'Network error while connecting to MT5 API service. Please check that the service is running and accessible. Start it with: trading-engine/run_mt5_api.bat',
          };
        }
      }
      // Re-throw to be caught by outer catch with more context
      throw connectionError;
    }
    
  } catch (error) {
    console.error('Error calling MT5 API:', error);
    
    if (error instanceof Error) {
      // Handle timeout errors that might have slipped through
      if (error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('aborted')) {
        return {
          connected: false,
          error: 'MT5 API service request timed out. Please ensure:\n1. The MT5 API service is running (trading-engine/run_mt5_api.bat)\n2. MetaTrader 5 terminal is installed and running\n3. Your network connection is stable\n\nTry restarting the MT5 API service and ensure MT5 terminal is open.',
        };
      }
      
      // Handle network/connection errors
      if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED') || error.message.includes('network')) {
        return {
          connected: false,
          error: 'Cannot connect to MT5 API service. Please start the service by running: trading-engine/run_mt5_api.bat',
        };
      }
      
      // Generic error with helpful message
      return {
        connected: false,
        error: `Failed to connect to MT5 API service: ${error.message}\n\nPlease ensure:\n1. MT5 API service is running (trading-engine/run_mt5_api.bat)\n2. MetaTrader 5 terminal is installed\n3. Check the service logs for more details`,
      };
    }
    
    return {
      connected: false,
      error: 'Unknown error occurred while testing MT5 connection. Please check that the MT5 API service is running.',
    };
  }
}

/**
 * Get MT5 connection status and account info
 * 
 * This function checks the current MT5 connection status and returns
 * account information if connected.
 * 
 * @returns Promise<MT5ConnectionResult>
 */
export async function getMT5Status(): Promise<MT5ConnectionResult> {
  const apiUrl = getMT5ApiUrl();
  
  try {
    const response = await fetch(`${apiUrl}/mt5/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    const data = await response.json();
    
    return {
      connected: data.connected || false,
      account_info: data.account_info,
      error: data.error,
    };
  } catch (error) {
    console.error('Error fetching MT5 status:', error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return {
          connected: false,
          error: 'MT5 API service request timed out',
        };
      }
      
      if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
        return {
          connected: false,
          error: 'MT5 API service is not running',
        };
      }
    }
    
    return {
      connected: false,
      error: 'Failed to fetch MT5 status',
    };
  }
}

/**
 * Validate MT5 credentials format
 */
export function validateMT5Credentials(
  account_number: string,
  password: string,
  server: string
): { valid: boolean; error?: string } {
  if (!account_number || account_number.trim().length === 0) {
    return { valid: false, error: 'Account number is required' };
  }
  
  if (!password || password.trim().length === 0) {
    return { valid: false, error: 'Password is required' };
  }
  
  if (!server || server.trim().length === 0) {
    return { valid: false, error: 'Server is required' };
  }
  
  // Basic format validation
  if (!/^\d+$/.test(account_number.trim())) {
    return { valid: false, error: 'Account number must be numeric' };
  }
  
  return { valid: true };
}

