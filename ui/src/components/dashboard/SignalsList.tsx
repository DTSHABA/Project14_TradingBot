import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import type { TradingSignal } from '@/types/trading';

interface SignalsListProps {
  signals: TradingSignal[];
  isLoading?: boolean;
  error?: Error | null;
}

export function SignalsList({ signals, isLoading, error }: SignalsListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Signals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm">Failed to load signals</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (signals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Minus className="w-5 h-5" />
            <p className="text-sm">No signals available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSignalIcon = (signalType: string) => {
    switch (signalType) {
      case 'BUY':
        return <TrendingUp className="w-4 h-4" />;
      case 'SELL':
        return <TrendingDown className="w-4 h-4" />;
      case 'HOLD':
        return <Minus className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getSignalColor = (signalType: string) => {
    switch (signalType) {
      case 'BUY':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'SELL':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'HOLD':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      default:
        return '';
    }
  };

  const getStatusBadge = (signal: TradingSignal) => {
    if (signal.rejection_reason) {
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Rejected
        </Badge>
      );
    }
    if (signal.became_trade) {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Executed
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
        Pending
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Signals</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {signals.map((signal) => {
            const confidence = parseFloat(signal.confidence);
            const price = parseFloat(signal.price);
            const timestamp = new Date(signal.timestamp);
            const timeAgo = getTimeAgo(timestamp);

            return (
              <div
                key={signal.id}
                className={`p-3 rounded-lg border transition-all ${
                  signal.rejection_reason
                    ? 'bg-red-500/5 border-red-500/20'
                    : signal.became_trade
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`${getSignalColor(signal.signal_type)} flex items-center gap-1 px-2 py-0.5 text-xs font-semibold`}
                    >
                      {getSignalIcon(signal.signal_type)}
                      {signal.signal_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{timeAgo}</span>
                  </div>
                  {getStatusBadge(signal)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                  <div>
                    <span className="text-muted-foreground">Price: </span>
                    <span className="font-semibold">${price.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Confidence: </span>
                    <span className="font-semibold">{confidence.toFixed(1)}%</span>
                  </div>
                </div>

                {signal.rejection_reason && (
                  <div className="mt-2 p-2 bg-red-500/10 rounded text-xs text-red-600 dark:text-red-400">
                    <span className="font-semibold">Rejection: </span>
                    {signal.rejection_reason}
                  </div>
                )}

                {signal.reason && !signal.rejection_reason && (
                  <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {signal.reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}




