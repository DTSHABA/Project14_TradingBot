import { useState, useEffect, useCallback } from 'react';
import { getDashboardStatus, getActivityFeed } from '@/lib/api/dashboard';
import type { DashboardStatus, ActivityEvent } from '@/types/trading';

interface UseRealtimeDashboardReturn {
  status: DashboardStatus | null;
  activityFeed: ActivityEvent[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useRealtimeDashboard(intervalMs: number = 5000): UseRealtimeDashboardReturn {
  const [status, setStatus] = useState<DashboardStatus | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastEventTimestamp, setLastEventTimestamp] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch status and activity feed in parallel
      const [statusData, feedData] = await Promise.all([
        getDashboardStatus(),
        getActivityFeed({
          limit: 50,
          since: lastEventTimestamp || undefined,
        }),
      ]);

      setStatus(statusData);

      // Append new events to feed (prevent duplicates)
      if (feedData.events.length > 0) {
        setActivityFeed((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newEvents = feedData.events.filter((e) => !existingIds.has(e.id));
          const combined = [...newEvents, ...prev];
          // Keep only last 100 events
          return combined.slice(0, 100);
        });

        if (feedData.last_timestamp) {
          setLastEventTimestamp(feedData.last_timestamp);
        }
      } else if (lastEventTimestamp === null) {
        // First load - set initial feed
        setActivityFeed(feedData.events);
        if (feedData.last_timestamp) {
          setLastEventTimestamp(feedData.last_timestamp);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch dashboard data'));
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [lastEventTimestamp]);

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Set up polling interval
    const intervalId = setInterval(fetchData, intervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchData, intervalMs]);

  return {
    status,
    activityFeed,
    isLoading,
    error,
    refetch: fetchData,
  };
}

