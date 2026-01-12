import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { MT5LiveAccountInfo } from '@/types/trading';
import { TrendingUp, TrendingDown, DollarSign, Activity, Shield, Clock } from 'lucide-react';

interface MT5AccountInfoCardProps {
  accountInfo: MT5LiveAccountInfo | null;
  isLoading: boolean;
  error: Error | null;
}

export function MT5AccountInfoCard({ accountInfo, isLoading, error }: MT5AccountInfoCardProps) {
  if (isLoading && !accountInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>MT5 Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-destructive" />
            MT5 Account - Connection Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!accountInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>MT5 Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No account data available</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate margin level color
  const getMarginLevelColor = (level?: number) => {
    if (!level) return 'text-muted-foreground';
    if (level >= 200) return 'text-green-600 dark:text-green-400';
    if (level >= 100) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getMarginLevelBadge = (level?: number) => {
    if (!level) return null;
    if (level >= 200) return <Badge variant="default" className="bg-green-600">Healthy</Badge>;
    if (level >= 100) return <Badge variant="secondary" className="bg-yellow-600">Caution</Badge>;
    return <Badge variant="destructive">Warning</Badge>;
  };

  // Format last updated time
  const getTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return 'over 1h ago';
  };

  const profitLoss = accountInfo.equity - accountInfo.balance;
  const profitLossPercent = accountInfo.balance > 0 ? (profitLoss / accountInfo.balance) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            MT5 Account
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {getTimeAgo(accountInfo.last_updated)}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {accountInfo.broker_name || accountInfo.server}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance & Equity */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Balance</p>
            <p className="text-2xl font-bold">
              {accountInfo.currency} {accountInfo.balance.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Equity</p>
            <p className="text-2xl font-bold flex items-center gap-2">
              {accountInfo.currency} {accountInfo.equity.toFixed(2)}
              {profitLoss !== 0 && (
                <span className={`text-sm flex items-center ${profitLoss > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {profitLoss > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {profitLoss > 0 ? '+' : ''}{profitLoss.toFixed(2)} ({profitLossPercent > 0 ? '+' : ''}{profitLossPercent.toFixed(2)}%)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Margin Info */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Margin Used</p>
              <p className="text-lg font-semibold">
                {accountInfo.currency} {accountInfo.margin.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Free Margin</p>
              <p className="text-lg font-semibold">
                {accountInfo.currency} {accountInfo.margin_free.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Margin Level */}
        {accountInfo.margin_level !== undefined && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Margin Level</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${getMarginLevelColor(accountInfo.margin_level)}`}>
                  {accountInfo.margin_level.toFixed(2)}%
                </span>
                {getMarginLevelBadge(accountInfo.margin_level)}
              </div>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Connection Status</span>
            <Badge variant={accountInfo.connected ? 'default' : 'destructive'} className="flex items-center gap-1">
              <div className={`h-2 w-2 rounded-full ${accountInfo.connected ? 'bg-green-500' : 'bg-red-500'}`} />
              {accountInfo.connected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


