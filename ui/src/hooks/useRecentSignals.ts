import { useState, useEffect, useCallback } from 'react';
import { getSignals } from '@/lib/api/trading';
import type { TradingSignal } from '@/types/trading';

interface UseRecentSignalsOptions {
  mt5AccountId?: string;
  limit?: number;
  pollInterval?: number; // in milliseconds
  enabled?: boolean;
}

export function useRecentSignals(options: UseRecentSignalsOptions = {}) {
  const { mt5AccountId, limit = 10, pollInterval = 10000, enabled = true } = options;
  
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  const fetchSignals = useCallback(async () => {
    try {
      setError(null);
      const result = await getSignals({ 
        limit, 
        mt5_account_id: mt5AccountId 
      });
      
      if (result.signals && result.signals.length > 0) {
        setSignals(result.signals);
      } else {
        setSignals([]);
      }
    } catch (err) {
      console.error('Error fetching recent signals:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [mt5AccountId, limit]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setSignals([]);
      setError(null);
      return;
    }

    // Initial fetch
    setIsLoading(true);
    fetchSignals();

    // Set up polling
    const intervalId = setInterval(fetchSignals, pollInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, pollInterval, fetchSignals]);

  return {
    signals,
    isLoading,
    error,
    refetch: fetchSignals,
  };
}




