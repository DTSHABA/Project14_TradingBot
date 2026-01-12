import { useState, useEffect, useCallback } from 'react';
import { getTrades, type GetTradesParams } from '@/lib/api/trading';
import type { Trade } from '@/types/trading';

interface UseAllTradesOptions extends Omit<GetTradesParams, 'limit' | 'offset'> {
  enabled?: boolean;
  pollInterval?: number; // Polling interval in milliseconds (e.g., 15000 for 15 seconds)
}

export function useAllTrades(options: UseAllTradesOptions = {}) {
  const { enabled = true, pollInterval, ...filters } = options;

  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAllTrades = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all trades by using a large limit
      // We'll fetch in batches if needed, but for now use a large limit
      const result = await getTrades({
        ...filters,
        limit: 10000, // Large limit to get all trades
        offset: 0,
      });

      setTrades(result.trades);
    } catch (err) {
      console.error('Error fetching all trades:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setTrades([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, JSON.stringify(filters)]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchAllTrades();

    // Set up polling if pollInterval is provided
    if (pollInterval && pollInterval > 0) {
      const intervalId = setInterval(fetchAllTrades, pollInterval);
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [enabled, pollInterval, fetchAllTrades]);

  return {
    trades,
    isLoading,
    error,
  };
}

