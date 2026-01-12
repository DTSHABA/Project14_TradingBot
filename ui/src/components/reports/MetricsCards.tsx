import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Target, Clock, Trophy, Activity } from 'lucide-react';
import type { PerformanceMetrics } from '@/types/trading';

interface MetricsCardsProps {
  metrics: PerformanceMetrics | null;
  isLoading?: boolean;
}

export function MetricsCards({ metrics, isLoading }: MetricsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-secondary rounded w-24" />
                <div className="h-8 bg-secondary rounded w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          No performance data available
        </CardContent>
      </Card>
    );
  }

  const metricCards = [
    {
      title: 'Total Trades',
      value: metrics.total_trades,
      icon: Activity,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Win Rate',
      value: `${metrics.win_rate.toFixed(1)}%`,
      icon: Trophy,
      color: metrics.win_rate >= 50 ? 'text-green-600' : 'text-red-600',
      bgColor: metrics.win_rate >= 50 ? 'bg-green-500/10' : 'bg-red-500/10',
    },
    {
      title: 'Profit Factor',
      value: metrics.profit_factor.toFixed(2),
      icon: Target,
      color: metrics.profit_factor >= 1.5 ? 'text-green-600' : 'text-yellow-600',
      bgColor: metrics.profit_factor >= 1.5 ? 'bg-green-500/10' : 'bg-yellow-500/10',
    },
    {
      title: 'Avg Win',
      value: `$${metrics.avg_win.toFixed(2)}`,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Avg Loss',
      value: `$${Math.abs(metrics.avg_loss).toFixed(2)}`,
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'Avg Hold Time',
      value: formatHoldTime(metrics.avg_hold_time),
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.title} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{metric.title}</p>
                    <p className="text-3xl font-bold">{metric.value}</p>
                  </div>
                  <div className={`${metric.bgColor} ${metric.color} p-3 rounded-full`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Advanced Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
              <p className="text-2xl font-bold">{metrics.sharpe_ratio.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                {metrics.sharpe_ratio > 1 ? 'Good' : metrics.sharpe_ratio > 0 ? 'Fair' : 'Poor'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Max Drawdown</p>
              <p className="text-2xl font-bold text-red-600">
                {(metrics.max_drawdown * 100).toFixed(2)}%
              </p>
              <p className="text-xs text-muted-foreground">Peak to trough decline</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Largest Win</p>
              <p className="text-2xl font-bold text-green-600">
                ${metrics.largest_win.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Best single trade</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Largest Loss</p>
              <p className="text-2xl font-bold text-red-600">
                ${Math.abs(metrics.largest_loss).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Worst single trade</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best/Worst Days */}
      {(metrics.best_day || metrics.worst_day) && (
        <div className="grid gap-4 md:grid-cols-2">
          {metrics.best_day && (
            <Card className="border-green-500/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Best Day
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-green-600">
                    +${metrics.best_day.pnl.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(metrics.best_day.date).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {metrics.worst_day && (
            <Card className="border-red-500/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                  Worst Day
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-red-600">
                    ${metrics.worst_day.pnl.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(metrics.worst_day.date).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function formatHoldTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

