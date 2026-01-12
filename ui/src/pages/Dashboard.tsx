import { useEffect, useState } from 'react';
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard';
import { useMT5Connection } from '@/hooks/useMT5Connection';
import { useMT5AccountInfo } from '@/hooks/useMT5AccountInfo';
import { useCurrentSignal } from '@/hooks/useCurrentSignal';
import { useRecentSignals } from '@/hooks/useRecentSignals';
import { getBotConfig } from '@/lib/api/bot-config';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { SignalCard } from '@/components/dashboard/SignalCard';
import { SignalsList } from '@/components/dashboard/SignalsList';
import { ConnectionStatusIndicator } from '@/components/mt5/ConnectionStatusIndicator';
import { MT5AccountInfoCard } from '@/components/mt5/MT5AccountInfoCard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500';

export function Dashboard() {
  const { status, activityFeed, isLoading, error, refetch } = useRealtimeDashboard(5000);
  const { accounts } = useMT5Connection();
  const [botConfigId, setBotConfigId] = useState<string | null>(null);
  const [isTradingActive, setIsTradingActive] = useState(false);

  const activeAccount = accounts.find((a) => a.is_active);
  
  // Fetch live MT5 account info with polling
  const { 
    accountInfo: mt5AccountInfo, 
    isLoading: mt5Loading, 
    error: mt5Error 
  } = useMT5AccountInfo({
    pollInterval: 10000, // Poll every 10 seconds
    enabled: !!activeAccount
  });
  
  // Fetch current AI signal with polling
  const { 
    signal, 
    isLoading: signalLoading, 
    error: signalError 
  } = useCurrentSignal({ 
    mt5AccountId: activeAccount?.id,
    pollInterval: 10000, // Poll every 10 seconds
    enabled: !!activeAccount 
  });

  // Fetch recent signals list
  const {
    signals: recentSignals,
    isLoading: recentSignalsLoading,
    error: recentSignalsError
  } = useRecentSignals({
    mt5AccountId: activeAccount?.id,
    limit: 20,
    pollInterval: 10000,
    enabled: !!activeAccount
  });

  useEffect(() => {
    if (activeAccount) {
      getBotConfig(activeAccount.id)
        .then((config) => {
          setBotConfigId(config.id);
          setIsTradingActive(config.is_trading_active);
        })
        .catch(console.error);
    }
  }, [activeAccount]);

  if (isLoading && !status) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !status) {
    const isNetworkError = error.message.includes('Unable to connect to server') || 
                          error.message.includes('Failed to fetch');
    
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-destructive">Error loading dashboard</h2>
              <p className="text-muted-foreground">{error.message}</p>
              {isNetworkError && (
                <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                  <p className="text-sm font-medium">Troubleshooting steps:</p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Ensure the server is running</li>
                    <li>Check that the API URL is correct (currently: {API_BASE_URL})</li>
                    <li>Verify your network connection</li>
                    <li>Check browser console for more details</li>
                  </ul>
                </div>
              )}
              <Button onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Trading Dashboard</h1>
        {activeAccount && (
          <ConnectionStatusIndicator account={activeAccount} isTradingActive={isTradingActive} />
        )}
      </div>

      {/* Equity Error Alert */}
      {status?.equity_error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <span className="text-destructive font-medium">⚠️ Equity Unavailable</span>
              <span className="text-sm text-muted-foreground">{status.equity_error}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Please check your MT5 connection and ensure your account credentials are correct.
            </p>
          </CardContent>
        </Card>
      )}

      {/* MT5 Account Info & Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* MT5 Live Account Info */}
        <div className="lg:col-span-1">
          <MT5AccountInfoCard 
            accountInfo={mt5AccountInfo}
            isLoading={mt5Loading}
            error={mt5Error}
          />
        </div>

        {/* Key Metrics */}
        <div className="lg:col-span-2 grid gap-4 md:grid-cols-2">
          <MetricCard
            title="Daily P&L"
            value={`$${(status?.daily_pnl?.amount ?? 0).toFixed(2)}`}
            change={
              status?.daily_pnl?.percent !== undefined
                ? {
                    amount: status.daily_pnl.amount ?? 0,
                    percent: status.daily_pnl.percent,
                    isPositive: (status.daily_pnl.amount ?? 0) >= 0,
                  }
                : undefined
            }
          />
          <MetricCard
            title="Today's Trades"
            value={status?.today_stats?.trades ?? 0}
          />
          <MetricCard
            title="Win Rate"
            value={`${(status?.today_stats?.win_rate ?? 0).toFixed(1)}%`}
          />
          <MetricCard
            title="Avg Hold Time"
            value={`${Math.floor((status?.today_stats?.avg_hold_time ?? 0) / 60)}m`}
          />
        </div>
      </div>

      {/* AI Signal Display */}
      <SignalCard 
        signal={signal} 
        isLoading={signalLoading} 
        error={signalError}
      />

      {/* Signals List */}
      <SignalsList 
        signals={recentSignals}
        isLoading={recentSignalsLoading}
        error={recentSignalsError}
      />

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Activity Feed */}
        <div className="lg:col-span-2">
          <ActivityFeed events={activityFeed} />
        </div>

        {/* Quick Actions */}
        <div>
          <QuickActions
            status={status}
            mt5AccountId={activeAccount?.id || null}
            botConfigId={botConfigId}
            onStatusUpdate={() => {
              refetch();
              if (activeAccount) {
                getBotConfig(activeAccount.id)
                  .then((config) => setIsTradingActive(config.is_trading_active))
                  .catch(console.error);
              }
            }}
          />
        </div>
      </div>

      {/* Open Position Info */}
      {status?.open_position && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Open Position</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Direction</p>
                <p className="text-lg font-semibold">{status.open_position.direction || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entry Price</p>
                <p className="text-lg font-semibold">${(parseFloat(String(status.open_position.entry_price ?? 0))).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lot Size</p>
                <p className="text-lg font-semibold">{status.open_position.lot_size ?? '0.00'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stop Loss</p>
                <p className="text-lg font-semibold">${(parseFloat(String(status.open_position.stop_loss ?? 0))).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {!status && !isLoading && !error && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">No dashboard data available</p>
              <p className="text-sm text-muted-foreground">
                Make sure your MT5 account is connected and the trading bot is configured.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

