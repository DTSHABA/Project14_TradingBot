import { useState, useEffect, useCallback, useRef } from 'react';
import { getMT5LiveAccountInfo } from '@/lib/api/mt5';
import type { MT5LiveAccountInfo } from '@/types/trading';

interface UseMT5AccountInfoOptions {
  pollInterval?: number; // milliseconds, default 10000 (10 seconds)
  enabled?: boolean; // default true
}

interface UseMT5AccountInfoReturn {
  accountInfo: MT5LiveAccountInfo | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useMT5AccountInfo(options: UseMT5AccountInfoOptions = {}): UseMT5AccountInfoReturn {
  const { pollInterval = 10000, enabled = true } = options;
  
  const [accountInfo, setAccountInfo] = useState<MT5LiveAccountInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchAccountInfo = useCallback(async () => {
    if (!enabled) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await getMT5LiveAccountInfo();
      
      if (isMountedRef.current) {
        setAccountInfo(data);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error('Failed to fetch MT5 account info');
        setError(error);
        console.error('Error fetching MT5 account info:', error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [enabled]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchAccountInfo();
    }
  }, [enabled, fetchAccountInfo]);

  // Setup polling
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Setup new interval
    intervalRef.current = setInterval(() => {
      fetchAccountInfo();
    }, pollInterval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, pollInterval, fetchAccountInfo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    accountInfo,
    isLoading,
    error,
    refetch: fetchAccountInfo,
  };
}


