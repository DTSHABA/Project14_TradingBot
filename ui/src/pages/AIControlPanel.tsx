import { useState, useEffect } from 'react';
import { useMT5Connection } from '@/hooks/useMT5Connection';
import { useMT5AccountInfo } from '@/hooks/useMT5AccountInfo';
import { useCurrentSignal } from '@/hooks/useCurrentSignal';
import { getBotConfig, toggleTrading } from '@/lib/api/bot-config';
import { SignalDisplay } from '@/components/ai/SignalDisplay';
import { MT5AccountInfoCard } from '@/components/mt5/MT5AccountInfoCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Play, Square, Activity, AlertTriangle, CheckCircle, Pause } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { BotConfig } from '@/types/trading';

export function AIControlPanel() {
  const { accounts, activateAccount, refreshAccounts } = useMT5Connection();
  const activeAccount = accounts.find((a) => a.is_active);
  
  // If no active account but there's a connected account, use that
  const connectedAccount = !activeAccount 
    ? accounts.find((a) => a.connection_status === 'connected')
    : null;
  
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountToUse = activeAccount || connectedAccount;
  
  const { signal, isLoading: signalLoading } = useCurrentSignal({
    mt5AccountId: accountToUse?.id,
    pollInterval: 10000,
    enabled: !!accountToUse,
  });

  // Fetch live MT5 account info
  const { 
    accountInfo: mt5AccountInfo, 
    isLoading: mt5Loading, 
    error: mt5Error 
  } = useMT5AccountInfo({
    pollInterval: 10000,
    enabled: !!accountToUse
  });

  // Fetch bot config
  useEffect(() => {
    if (accountToUse) {
      setIsLoadingConfig(true);
      getBotConfig(accountToUse.id)
        .then((config) => {
          setBotConfig(config);
          setError(null);
        })
        .catch((err) => {
          console.error('Error fetching bot config:', err);
          setError('Failed to load bot configuration');
        })
        .finally(() => {
          setIsLoadingConfig(false);
        });
    } else {
      setIsLoadingConfig(false);
    }
  }, [activeAccount, connectedAccount]);

  const handleToggleTrading = async () => {
    if (!botConfig) return;

    setIsToggling(true);
    setError(null);

    try {
      const result = await toggleTrading(botConfig.id);
      setBotConfig((prev) => 
        prev ? { ...prev, is_trading_active: result.is_trading_active } : null
      );
    } catch (err) {
      console.error('Error toggling trading:', err);
      setError('Failed to toggle trading status');
    } finally {
      setIsToggling(false);
    }
  };

  const getBotStatus = () => {
    if (!botConfig) return { status: 'inactive', label: 'Inactive', color: 'text-gray-500', icon: Square };
    if (botConfig.is_trading_active && accountToUse?.connection_status === 'connected') {
      return { status: 'active', label: 'Active', color: 'text-green-600', icon: Activity };
    }
    if (botConfig.is_trading_active && accountToUse?.connection_status === 'paused') {
      return { status: 'paused', label: 'Paused', color: 'text-yellow-600', icon: Pause };
    }
    if (accountToUse?.connection_status === 'error') {
      return { status: 'error', label: 'Error', color: 'text-red-600', icon: AlertTriangle };
    }
    return { status: 'inactive', label: 'Stopped', color: 'text-gray-500', icon: Square };
  };

  const botStatus = getBotStatus();
  const StatusIcon = botStatus.icon;

  // Handle case where account exists but is not active
  const handleActivateAccount = async () => {
    if (connectedAccount) {
      try {
        await activateAccount(connectedAccount.id);
        await refreshAccounts();
      } catch (err) {
        console.error('Error activating account:', err);
      }
    }
  };

  if (!activeAccount && !connectedAccount) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12">
            <div className="text-center space-y-4">
              <AlertTriangle className="w-16 h-16 mx-auto text-yellow-600" />
              <h2 className="text-2xl font-bold">No Active MT5 Account</h2>
              <p className="text-muted-foreground">
                Please connect an MT5 account to use the AI trading bot.
              </p>
              <Button onClick={() => window.location.href = '/onboarding'}>
                Connect Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!accountToUse) {
    return null; // Should not happen, but TypeScript safety
  }

  if (isLoadingConfig) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Control Panel</h1>
          <p className="text-muted-foreground mt-1">
            Control your autonomous trading bot and monitor AI signals
          </p>
        </div>
        <Badge 
          variant="outline" 
          className={`${botStatus.color} flex items-center gap-2 px-4 py-2 text-base font-semibold border-2`}
        >
          <StatusIcon className="w-5 h-5" />
          {botStatus.label}
        </Badge>
      </div>

      {!activeAccount && connectedAccount && (
        <Card className="border-yellow-500 bg-yellow-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="w-5 h-5" />
                <p>Your MT5 account is connected but not active. Activate it to use the AI trading bot.</p>
              </div>
              <Button onClick={handleActivateAccount} variant="outline" size="sm">
                Activate Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MT5 Account Info & Bot Control */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* MT5 Live Account Info */}
        <div className="md:col-span-1">
          <MT5AccountInfoCard 
            accountInfo={mt5AccountInfo}
            isLoading={mt5Loading}
            error={mt5Error}
          />
        </div>

        {/* Bot Control Card */}
        <Card className="border-2 md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Trading Bot Control</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground text-muted-foreground flex items-center justify-center text-xs cursor-help">
                      ?
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="font-semibold mb-1">About the Trading Bot</p>
                    <p className="text-sm">
                      When active, the bot monitors market conditions in real-time and 
                      executes trades based on AI signals. It automatically manages risk, 
                      position sizing, and follows your configured trading sessions.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              Start or stop the autonomous trading loop
            </CardDescription>
          </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle Control */}
          <div className="flex items-center justify-between p-6 bg-secondary/30 rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="trading-active" className="text-lg font-semibold">
                Trading Loop
              </Label>
              <p className="text-sm text-muted-foreground">
                {botConfig?.is_trading_active 
                  ? 'Bot is actively monitoring and trading'
                  : 'Bot is stopped - no trades will be executed'
                }
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Switch
                id="trading-active"
                checked={botConfig?.is_trading_active || false}
                onCheckedChange={handleToggleTrading}
                disabled={isToggling || !botConfig}
                className="data-[state=checked]:bg-green-500"
              />
              <Button
                size="lg"
                onClick={handleToggleTrading}
                disabled={isToggling || !botConfig}
                className={
                  botConfig?.is_trading_active
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }
              >
                {isToggling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    {botConfig?.is_trading_active ? 'Stopping...' : 'Starting...'}
                  </>
                ) : botConfig?.is_trading_active ? (
                  <>
                    <Square className="w-5 h-5 mr-2" />
                    Stop Trading
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Start Trading
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Bot Configuration Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Risk Per Trade</p>
              <p className="text-lg font-semibold">{botConfig?.risk_percent}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Risk:Reward Ratio</p>
              <p className="text-lg font-semibold">1:{botConfig?.risk_reward_ratio}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Stop Loss Range</p>
              <p className="text-lg font-semibold">
                {botConfig?.stop_loss_range?.min}% - {botConfig?.stop_loss_range?.max}%
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Trading Sessions</p>
              <p className="text-lg font-semibold">{botConfig?.trading_sessions?.length || 0}</p>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant={accountToUse.connection_status === 'connected' ? 'default' : 'secondary'}>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    MT5: {accountToUse.connection_status}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>MetaTrader 5 connection status</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant={botConfig?.is_trading_active ? 'default' : 'secondary'}>
                    <Activity className="w-3 h-3 mr-1" />
                    Trading: {botConfig?.is_trading_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Bot trading loop status</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
        </Card>
      </div>

      {/* AI Signal Display */}
      <SignalDisplay signal={signal} isLoading={signalLoading} />

      {/* Safety Information */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-blue-600" />
            Important Safety Information
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            • The AI bot operates autonomously and will execute trades based on signals and risk management rules.
          </p>
          <p>
            • Always ensure you have sufficient account balance and understand the risks involved in automated trading.
          </p>
          <p>
            • Monitor your trades regularly and adjust bot configuration as needed in Settings.
          </p>
          <p>
            • You can stop the bot at any time using the controls above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

