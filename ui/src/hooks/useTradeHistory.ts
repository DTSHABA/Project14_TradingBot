import { useState, useEffect, useCallback } from 'react';
import { getTrades, type GetTradesParams } from '@/lib/api/trading';
import type { Trade } from '@/types/trading';

interface UseTradeHistoryOptions extends GetTradesParams {
  enabled?: boolean;
  pollInterval?: number; // Polling interval in milliseconds (e.g., 10000 for 10 seconds)
}

interface PaginationInfo {
  limit: number;
  offset: number;
  total: number;
  currentPage: number;
  totalPages: number;
}

export function useTradeHistory(options: UseTradeHistoryOptions = {}) {
  const { 
    enabled = true,
    limit = 20,
    offset: initialOffset = 0,
    pollInterval,
    ...initialFilters 
  } = options;

  const [trades, setTrades] = useState<Trade[]>([]);
  const [currentFilters, setCurrentFilters] = useState<GetTradesParams>(initialFilters);
  const [currentOffset, setCurrentOffset] = useState(initialOffset);
  const [pagination, setPagination] = useState<PaginationInfo>({
    limit,
    offset: initialOffset,
    total: 0,
    currentPage: 1,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrades = useCallback(async (params: GetTradesParams = {}) => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // Merge current filters with new params
      const mergedParams = {
        limit,
        offset: params.offset !== undefined ? params.offset : currentOffset,
        ...currentFilters,
        ...params,
      };

      const result = await getTrades(mergedParams);

      setTrades(result.trades);
      
      const totalPages = Math.ceil(result.pagination.total / limit);
      const currentPage = Math.floor(result.pagination.offset / limit) + 1;
      
      setCurrentOffset(result.pagination.offset);
      setPagination({
        ...result.pagination,
        currentPage,
        totalPages,
      });
    } catch (err) {
      console.error('Error fetching trades:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setTrades([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, limit, currentOffset, JSON.stringify(currentFilters)]);

  // Update filters when initialFilters change (e.g., when mt5_account_id changes)
  useEffect(() => {
    setCurrentFilters(initialFilters);
  }, [JSON.stringify(initialFilters)]);

  // Fetch trades when filters or offset change
  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // Set up polling if pollInterval is provided
  useEffect(() => {
    if (!enabled || !pollInterval || pollInterval <= 0) {
      return;
    }

    // Create a stable refetch function that doesn't depend on changing callbacks
    const pollRefetch = () => {
      // Only refetch if we're on the first page (offset 0) to avoid disrupting pagination
      if (currentOffset === 0) {
        // Use the current filters and offset directly
        getTrades({
          limit,
          offset: 0,
          ...currentFilters,
        })
          .then((result) => {
            setTrades(result.trades);
            const totalPages = Math.ceil(result.pagination.total / limit);
            setCurrentOffset(0);
            setPagination({
              ...result.pagination,
              currentPage: 1,
              totalPages,
            });
          })
          .catch((err) => {
            console.error('Error polling trades:', err);
          });
      }
    };

    const intervalId = setInterval(pollRefetch, pollInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, pollInterval, currentOffset, limit, JSON.stringify(currentFilters)]);

  const goToPage = useCallback((page: number) => {
    const newOffset = (page - 1) * limit;
    setCurrentOffset(newOffset);
    fetchTrades({ offset: newOffset });
  }, [limit, fetchTrades]);

  const nextPage = useCallback(() => {
    if (pagination.currentPage < pagination.totalPages) {
      goToPage(pagination.currentPage + 1);
    }
  }, [pagination.currentPage, pagination.totalPages, goToPage]);

  const previousPage = useCallback(() => {
    if (pagination.currentPage > 1) {
      goToPage(pagination.currentPage - 1);
    }
  }, [pagination.currentPage, goToPage]);

  const applyFilters = useCallback((newFilters: GetTradesParams) => {
    // Update filters and reset to first page, then fetch immediately
    const updatedFilters = {
      ...currentFilters,
      ...newFilters,
    };
    setCurrentFilters(updatedFilters);
    setCurrentOffset(0);
    // Fetch immediately with new filters
    fetchTrades({ ...updatedFilters, offset: 0 });
  }, [currentFilters, fetchTrades]);

  return {
    trades,
    pagination,
    isLoading,
    error,
    refetch: fetchTrades,
    goToPage,
    nextPage,
    previousPage,
    applyFilters,
  };
}

