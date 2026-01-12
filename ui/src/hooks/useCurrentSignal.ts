import { useState, useEffect, useCallback } from 'react';
import { getSignals } from '@/lib/api/trading';
import type { TradingSignal } from '@/types/trading';

interface UseCurrentSignalOptions {
  mt5AccountId?: string;
  pollInterval?: number; // in milliseconds
  enabled?: boolean;
}

export function useCurrentSignal(options: UseCurrentSignalOptions = {}) {
  const { mt5AccountId, pollInterval = 5000, enabled = true } = options;
  
  const [signal, setSignal] = useState<TradingSignal | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  const fetchSignal = useCallback(async () => {
    try {
      setError(null);
      const result = await getSignals({ 
        limit: 1, 
        mt5_account_id: mt5AccountId 
      });
      
      if (result.signals && result.signals.length > 0) {
        setSignal(result.signals[0]);
      } else {
        setSignal(null);
      }
    } catch (err) {
      console.error('Error fetching current signal:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [mt5AccountId]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setSignal(null);
      setError(null);
      return;
    }

    // Initial fetch
    setIsLoading(true);
    fetchSignal();

    // Set up polling
    const intervalId = setInterval(fetchSignal, pollInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, pollInterval, fetchSignal]);

  return {
    signal,
    isLoading,
    error,
    refetch: fetchSignal,
  };
}

