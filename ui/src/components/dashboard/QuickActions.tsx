import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { forceClosePosition, resetCircuitBreaker } from '@/lib/api/dashboard';
import { toggleTrading } from '@/lib/api/bot-config';
import type { DashboardStatus } from '@/types/trading';

interface QuickActionsProps {
  status: DashboardStatus | null;
  mt5AccountId: string | null;
  botConfigId: string | null;
  onStatusUpdate: () => void;
}

export function QuickActions({ status, mt5AccountId, botConfigId, onStatusUpdate }: QuickActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleTrading = async () => {
    if (!botConfigId) return;

    setIsLoading(true);
    setError(null);

    try {
      await toggleTrading(botConfigId);
      onStatusUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle trading');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceClose = async () => {
    if (!mt5AccountId || !status?.open_position) return;

    if (!confirm('Are you sure you want to force close the open position?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await forceClosePosition(mt5AccountId);
      onStatusUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to force close position');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetCircuitBreaker = async () => {
    if (!mt5AccountId) return;

    if (!confirm('Are you sure you want to reset the circuit breaker?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await resetCircuitBreaker(mt5AccountId);
      onStatusUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset circuit breaker');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && (
          <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button
          onClick={handleToggleTrading}
          disabled={isLoading || !botConfigId}
          className="w-full"
          variant={status?.bot_status === 'active' ? 'destructive' : 'default'}
        >
          {status?.bot_status === 'active' ? 'Pause Trading' : 'Resume Trading'}
        </Button>

        <Button
          onClick={handleForceClose}
          disabled={isLoading || !status?.open_position || !mt5AccountId}
          variant="outline"
          className="w-full"
        >
          Force Close Position
        </Button>

        <Button
          onClick={handleResetCircuitBreaker}
          disabled={isLoading || !mt5AccountId}
          variant="outline"
          className="w-full"
        >
          Reset Circuit Breaker
        </Button>
      </CardContent>
    </Card>
  );
}

