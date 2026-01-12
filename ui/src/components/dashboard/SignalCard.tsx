import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import type { TradingSignal } from '@/types/trading';

interface SignalCardProps {
  signal: TradingSignal | null;
  isLoading?: boolean;
  error?: Error | null;
}

export function SignalCard({ signal, isLoading, error }: SignalCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current AI Signal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current AI Signal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm">Failed to load signal</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!signal) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current AI Signal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Minus className="w-5 h-5" />
            <p className="text-sm">No signal available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSignalColor = (signalType: string) => {
    switch (signalType) {
      case 'BUY':
        return 'bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20';
      case 'SELL':
        return 'bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20';
      case 'HOLD':
        return 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/20';
      default:
        return '';
    }
  };

  const getSignalIcon = (signalType: string) => {
    switch (signalType) {
      case 'BUY':
        return <TrendingUp className="w-5 h-5" />;
      case 'SELL':
        return <TrendingDown className="w-5 h-5" />;
      case 'HOLD':
        return <Minus className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const confidence = parseFloat(signal.confidence);
  const formattedTime = new Date(signal.timestamp).toLocaleString();
  const price = parseFloat(signal.price);

  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Current AI Signal</span>
          <Badge 
            variant="outline" 
            className={`${getSignalColor(signal.signal_type)} flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold`}
          >
            {getSignalIcon(signal.signal_type)}
            {signal.signal_type}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Confidence Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Confidence</span>
            <span className="font-semibold">{confidence.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                confidence >= 70
                  ? 'bg-green-500'
                  : confidence >= 50
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        {/* Signal Details */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="text-lg font-semibold">${price.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Time</p>
            <p className="text-sm font-medium">{new Date(signal.timestamp).toLocaleTimeString()}</p>
          </div>
        </div>

        {/* AI Reasoning */}
        {signal.reason && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">AI Reasoning</p>
            <p className="text-sm leading-relaxed">{signal.reason}</p>
          </div>
        )}

        {/* Status Indicators */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex gap-2">
            {signal.became_trade && (
              <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                ✓ Executed
              </Badge>
            )}
            {signal.rejection_reason && (
              <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">
                ✗ Rejected
              </Badge>
            )}
            {!signal.became_trade && !signal.rejection_reason && (
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                Pending
              </Badge>
            )}
          </div>
          {signal.rejection_reason && (
            <div className="p-2 bg-red-500/10 rounded text-sm text-red-600 dark:text-red-400 border border-red-500/20">
              <span className="font-semibold">Rejection Reason: </span>
              {signal.rejection_reason}
            </div>
          )}
        </div>

        {/* Timestamp footer */}
        <div className="pt-2 text-xs text-muted-foreground">
          Last updated: {formattedTime}
        </div>
      </CardContent>
    </Card>
  );
}

