import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Clock, Target, BarChart3 } from 'lucide-react';
import type { PerformanceMetrics } from '@/types/trading';

interface PerformanceMetricsCardsProps {
  metrics: PerformanceMetrics | null;
  isLoading?: boolean;
}

export function PerformanceMetricsCards({ metrics, isLoading }: PerformanceMetricsCardsProps) {
  if (isLoading || !metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 bg-secondary animate-pulse rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-secondary animate-pulse rounded w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Trades */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.total_trades}</div>
          <p className="text-xs text-muted-foreground">Closed positions</p>
        </CardContent>
      </Card>

      {/* Win Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${metrics.win_rate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
            {metrics.win_rate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics.total_trades > 0 
              ? `${Math.round((metrics.win_rate / 100) * metrics.total_trades)} wins`
              : 'No trades'
            }
          </p>
        </CardContent>
      </Card>

      {/* Profit Factor */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Profit Factor</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${metrics.profit_factor >= 1 ? 'text-green-600' : 'text-red-600'}`}>
            {metrics.profit_factor === Infinity ? '∞' : metrics.profit_factor.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics.profit_factor >= 1 ? 'Profitable' : 'Unprofitable'}
          </p>
        </CardContent>
      </Card>

      {/* Sharpe Ratio */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${metrics.sharpe_ratio >= 1 ? 'text-green-600' : metrics.sharpe_ratio > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
            {metrics.sharpe_ratio.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics.sharpe_ratio >= 1 ? 'Good' : metrics.sharpe_ratio > 0 ? 'Fair' : 'Poor'}
          </p>
        </CardContent>
      </Card>

      {/* Average Win */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Win</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            ${metrics.avg_win.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">Per winning trade</p>
        </CardContent>
      </Card>

      {/* Average Loss */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Loss</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            ${Math.abs(metrics.avg_loss).toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">Per losing trade</p>
        </CardContent>
      </Card>

      {/* Largest Win */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Largest Win</CardTitle>
          <DollarSign className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            ${metrics.largest_win.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">Best single trade</p>
        </CardContent>
      </Card>

      {/* Largest Loss */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Largest Loss</CardTitle>
          <DollarSign className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            ${Math.abs(metrics.largest_loss).toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">Worst single trade</p>
        </CardContent>
      </Card>

      {/* Average Hold Time */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Hold Time</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatTime(metrics.avg_hold_time)}</div>
          <p className="text-xs text-muted-foreground">Per trade</p>
        </CardContent>
      </Card>

      {/* Max Hold Time */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Max Hold Time</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatTime(metrics.max_hold_time)}</div>
          <p className="text-xs text-muted-foreground">Longest position</p>
        </CardContent>
      </Card>

      {/* Max Drawdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {metrics.max_drawdown.toFixed(2)}%
          </div>
          <p className="text-xs text-muted-foreground">Peak to trough</p>
        </CardContent>
      </Card>

      {/* Best Day */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Best Day</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          {metrics.best_day ? (
            <>
              <div className="text-2xl font-bold text-green-600">
                ${metrics.best_day.pnl.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(metrics.best_day.date)}
              </p>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">No data</div>
          )}
        </CardContent>
      </Card>

      {/* Worst Day */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Worst Day</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          {metrics.worst_day ? (
            <>
              <div className="text-2xl font-bold text-red-600">
                ${metrics.worst_day.pnl.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(metrics.worst_day.date)}
              </p>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">No data</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

