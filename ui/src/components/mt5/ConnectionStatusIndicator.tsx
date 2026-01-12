import { Badge } from '@/components/ui/badge';
import type { MT5Account } from '@/types/trading';

interface ConnectionStatusIndicatorProps {
  account: MT5Account;
  isTradingActive?: boolean;
}

export function ConnectionStatusIndicator({ account, isTradingActive = false }: ConnectionStatusIndicatorProps) {
  const getStatusConfig = () => {
    if (account.connection_status === 'connected' && isTradingActive) {
      return {
        color: 'bg-green-500',
        text: 'Connected and Trading',
        variant: 'default' as const,
      };
    }
    if (account.connection_status === 'connected' && !isTradingActive) {
      return {
        color: 'bg-yellow-500',
        text: 'Connected but Paused',
        variant: 'secondary' as const,
      };
    }
    if (account.connection_status === 'error') {
      return {
        color: 'bg-red-500',
        text: 'Error',
        variant: 'destructive' as const,
      };
    }
    return {
      color: 'bg-red-500',
      text: 'Disconnected',
      variant: 'secondary' as const,
    };
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${config.color}`} />
      <Badge variant={config.variant}>{config.text}</Badge>
    </div>
  );
}

