import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { MT5LiveAccountInfo } from '@/types/trading';
import type { PerformanceMetrics } from '@/types/trading';
import { TrendingUp, TrendingDown, DollarSign, Percent, Target, AlertTriangle } from 'lucide-react';

interface AccountPerformanceSummaryProps {
  accountInfo: MT5LiveAccountInfo | null;
  metrics: PerformanceMetrics | null;
  isLoading: boolean;
}

export function AccountPerformanceSummary({ 
  accountInfo, 
  metrics, 
  isLoading 
}: AccountPerformanceSummaryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!accountInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No account data available</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate account performance metrics
  const balance = accountInfo.balance;
  const equity = accountInfo.equity;
  const unrealizedPnL = equity - balance;
  const unrealizedPnLPercent = balance > 0 ? ((unrealizedPnL / balance) * 100) : 0;

  // Calculate ROI if we have metrics (assuming starting balance is current balance minus total P&L)
  let roi = null;
  let totalPnL = null;
  if (metrics && metrics.total_trades > 0) {
    // Estimate total P&L from metrics (this is approximate)
    // In a real scenario, you'd track starting balance separately
    totalPnL = (metrics.avg_win * metrics.total_trades * (metrics.win_rate / 100)) + 
                (metrics.avg_loss * metrics.total_trades * ((100 - metrics.win_rate) / 100));
    
    // Estimate starting balance (current balance minus total P&L)
    const estimatedStartingBalance = balance - (totalPnL || 0);
    if (estimatedStartingBalance > 0) {
      roi = ((balance - estimatedStartingBalance) / estimatedStartingBalance) * 100;
    }
  }

  // Account health indicators
  const marginLevel = accountInfo.margin_level || 0;
  const getAccountHealth = () => {
    if (marginLevel === 0) return { status: 'unknown', color: 'text-muted-foreground', badge: 'secondary' };
    if (marginLevel >= 200) return { status: 'excellent', color: 'text-green-600', badge: 'default' };
    if (marginLevel >= 100) return { status: 'good', color: 'text-yellow-600', badge: 'secondary' };
    return { status: 'warning', color: 'text-red-600', badge: 'destructive' };
  };

  const health = getAccountHealth();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Account Performance Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Performance Indicators */}
        <div className="grid grid-cols-2 gap-4">
          {/* Unrealized P&L */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" />
              Unrealized P&L
            </p>
            <p className={`text-2xl font-bold flex items-center gap-2 ${unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {unrealizedPnL >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {accountInfo.currency} {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(2)}
            </p>
            <p className={`text-sm ${unrealizedPnLPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {unrealizedPnLPercent >= 0 ? '+' : ''}{unrealizedPnLPercent.toFixed(2)}%
            </p>
          </div>

          {/* Estimated ROI */}
          {roi !== null ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Percent className="h-3 w-3" />
                Estimated ROI
              </p>
              <p className={`text-2xl font-bold flex items-center gap-2 ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {roi >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
              </p>
              <p className="text-xs text-muted-foreground">Based on trade history</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total P&L</p>
              {totalPnL !== null ? (
                <>
                  <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {accountInfo.currency} {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">From {metrics?.total_trades || 0} trades</p>
                </>
              ) : (
                <p className="text-lg text-muted-foreground">N/A</p>
              )}
            </div>
          )}
        </div>

        {/* Account Health Status */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${health.color}`} />
              <span className="text-sm text-muted-foreground">Account Health</span>
            </div>
            <div className="flex items-center gap-2">
              {marginLevel > 0 && (
                <span className={`text-lg font-semibold ${health.color}`}>
                  {marginLevel.toFixed(1)}%
                </span>
              )}
              <Badge variant={health.badge as any} className="capitalize">
                {health.status}
              </Badge>
            </div>
          </div>
          {marginLevel > 0 && marginLevel < 100 && (
            <p className="text-xs text-yellow-600 mt-2">
              ⚠️ Margin level below 100% - Consider reducing position sizes or adding funds
            </p>
          )}
        </div>

        {/* Trading Statistics Summary */}
        {metrics && metrics.total_trades > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm font-semibold mb-3">Trading Statistics</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Trades</p>
                <p className="text-lg font-bold">{metrics.total_trades}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Win Rate</p>
                <p className={`text-lg font-bold ${metrics.win_rate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.win_rate.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Profit Factor</p>
                <p className={`text-lg font-bold ${metrics.profit_factor >= 1.5 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {metrics.profit_factor.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">MT5 Connection</span>
            <Badge variant={accountInfo.connected ? 'default' : 'destructive'} className="flex items-center gap-1">
              <div className={`h-2 w-2 rounded-full ${accountInfo.connected ? 'bg-green-500' : 'bg-red-500'}`} />
              {accountInfo.connected ? 'Live' : 'Disconnected'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


