import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityEvent } from '@/types/trading';

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

interface ActivityFeedProps {
  events: ActivityEvent[];
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom on new events
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  const getEventColor = (event: ActivityEvent) => {
    if (event.type === 'signal') {
      if (event.event_type === 'signal_rejected') {
        return 'text-red-600 dark:text-red-400';
      }
      if (event.event_type === 'signal_executed') {
        return 'text-green-600 dark:text-green-400';
      }
      return 'text-blue-600 dark:text-blue-400';
    }
    if (event.type === 'trade') {
      if (event.event_type === 'trade_closed') {
        return 'text-green-600 dark:text-green-400';
      }
      return 'text-purple-600 dark:text-purple-400';
    }
    if (event.type === 'circuit_breaker') {
      return 'text-yellow-600 dark:text-yellow-400';
    }
    return 'text-muted-foreground';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Feed</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={feedRef}
          className="max-h-96 space-y-2 overflow-y-auto pr-2"
          style={{ scrollbarWidth: 'thin' }}
        >
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet</p>
          ) : (
            events.map((event) => {
              const timestamp = event.timestamp instanceof Date
                ? event.timestamp
                : new Date(event.timestamp);
              const timeAgo = formatTimeAgo(timestamp);

              return (
                <div
                  key={event.id}
                  className="flex items-start gap-2 rounded-md border p-2 text-sm"
                >
                  <div className={`flex-1 ${getEventColor(event)}`}>
                    <p className="font-medium">{event.message}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

