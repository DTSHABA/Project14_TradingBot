import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TradingSignal } from '@/types/trading';
import { ConfidenceMeter } from './ConfidenceMeter';

interface SignalDisplayProps {
  signal: TradingSignal | null;
  isLoading?: boolean;
}

export function SignalDisplay({ signal, isLoading }: SignalDisplayProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Signal Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-secondary rounded w-32"></div>
            <div className="h-4 bg-secondary rounded w-full"></div>
            <div className="h-20 bg-secondary rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!signal) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Signal Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Minus className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No Active Signal</p>
            <p className="text-sm mt-2">The AI is monitoring the market</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSignalColor = (signalType: string) => {
    switch (signalType) {
      case 'BUY':
        return 'text-green-600 bg-green-500/10 border-green-500/20';
      case 'SELL':
        return 'text-red-600 bg-red-500/10 border-red-500/20';
      case 'HOLD':
        return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20';
      default:
        return '';
    }
  };

  const getSignalIcon = (signalType: string) => {
    switch (signalType) {
      case 'BUY':
        return <TrendingUp className="w-6 h-6" />;
      case 'SELL':
        return <TrendingDown className="w-6 h-6" />;
      case 'HOLD':
        return <Minus className="w-6 h-6" />;
      default:
        return null;
    }
  };

  const confidence = parseFloat(signal.confidence);
  const price = parseFloat(signal.price);
  const signalTime = new Date(signal.timestamp);
  const timeAgo = getTimeAgo(signalTime);

  return (
    <Card className="transition-all hover:shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>AI Signal Analysis</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className={`${getSignalColor(signal.signal_type)} flex items-center gap-2 px-4 py-2 text-base font-bold cursor-help`}
                >
                  {getSignalIcon(signal.signal_type)}
                  {signal.signal_type}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="font-semibold mb-1">Signal Type</p>
                <p className="text-sm">
                  {signal.signal_type === 'BUY' && 'The AI recommends opening a long position'}
                  {signal.signal_type === 'SELL' && 'The AI recommends opening a short position'}
                  {signal.signal_type === 'HOLD' && 'The AI recommends waiting for better conditions'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Confidence Meter */}
        <ConfidenceMeter confidence={confidence} />

        {/* Signal Details Grid */}
        <div className="grid grid-cols-2 gap-6 pt-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Price Level</p>
            <p className="text-2xl font-bold">${price.toFixed(2)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Generated</p>
            <p className="text-lg font-semibold">{timeAgo}</p>
            <p className="text-xs text-muted-foreground">{signalTime.toLocaleTimeString()}</p>
          </div>
        </div>

        {/* AI Reasoning Section */}
        {signal.reason && (
          <div className="pt-4 border-t space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">AI Reasoning</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground text-muted-foreground flex items-center justify-center text-xs cursor-help">
                      ?
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="font-semibold mb-1">Why the AI made this decision</p>
                    <p className="text-sm">
                      The AI analyzes multiple technical indicators, market conditions, 
                      and risk factors to generate this reasoning. This transparency 
                      helps you understand the logic behind each trading signal.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-sm leading-relaxed">{signal.reason}</p>
            </div>
          </div>
        )}

        {/* Status Badges */}
        <div className="flex flex-wrap gap-2 pt-2">
          {signal.became_trade && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
                    ✓ Executed
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This signal resulted in an actual trade</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {signal.rejection_reason && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="border-orange-500 text-orange-600">
                    ⚠ Rejected
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">Rejection Reason:</p>
                  <p className="text-sm">{signal.rejection_reason}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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

