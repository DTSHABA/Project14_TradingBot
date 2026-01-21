import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useMT5Connection } from '@/hooks/useMT5Connection';
import { getBotConfig, updateBotConfig } from '@/lib/api/bot-config';
import { testMT5Connection } from '@/lib/api/mt5';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  User, 
  Settings as SettingsIcon, 
  CreditCard, 
  Bell, 
  CheckCircle, 
  XCircle,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import type { BotConfig, TradingSession } from '@/types/trading';

const PRIME_SESSIONS: TradingSession[] = [
  { start: '08:00', end: '09:30', type: 'prime' },
  { start: '13:00', end: '15:00', type: 'prime' },
  { start: '14:30', end: '15:30', type: 'prime' },
];

const ACCEPTABLE_SESSIONS: TradingSession[] = [
  { start: '09:30', end: '13:00', type: 'acceptable' },
  { start: '15:30', end: '17:00', type: 'acceptable' },
];

export function Settings() {
  const { user } = useAuth();
  const { accounts, testConnection, activateAccount, refreshAccounts } = useMT5Connection();
  const activeAccount = accounts.find((a) => a.is_active);
  
  const [profile, setProfile] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
  });
  
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [testingAccountId, setTestingAccountId] = useState<string | null>(null);
  
  // Load bot config
  useEffect(() => {
    if (activeAccount) {
      setIsLoadingConfig(true);
      getBotConfig(activeAccount.id)
        .then(setBotConfig)
        .catch((err) => {
          console.error('Error loading bot config:', err);
          setConfigError('Failed to load bot configuration');
        })
        .finally(() => setIsLoadingConfig(false));
    } else {
      setIsLoadingConfig(false);
    }
  }, [activeAccount]);

  const handleSaveProfile = () => {
    // TODO: Implement save functionality
    console.log('Saving profile...', { profile });
  };

  const handleSaveBotConfig = async () => {
    if (!botConfig || !activeAccount) return;
    
    setIsSavingConfig(true);
    setConfigError(null);
    
    try {
      const updated = await updateBotConfig(botConfig.id, {
        risk_percent: parseFloat(botConfig.risk_percent),
        stop_loss_range: botConfig.stop_loss_range,
        risk_reward_ratio: parseFloat(botConfig.risk_reward_ratio),
        trading_sessions: botConfig.trading_sessions,
      });
      setBotConfig(updated);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSessionToggle = (session: TradingSession) => {
    if (!botConfig) return;
    
    const sessions = botConfig.trading_sessions || [];
    const exists = sessions.some(
      (s) => s.start === session.start && s.end === session.end
    );
    
    setBotConfig({
      ...botConfig,
      trading_sessions: exists
        ? sessions.filter((s) => s.start !== session.start || s.end !== session.end)
        : [...sessions, session],
    });
  };

  const handleTestConnection = async (accountId: string) => {
    setTestingAccountId(accountId);
    try {
      await testConnection(accountId);
      await refreshAccounts();
    } catch (err) {
      console.error('Connection test failed:', err);
    } finally {
      setTestingAccountId(null);
    }
  };

  const handleActivateAccount = async (accountId: string) => {
    try {
      await activateAccount(accountId);
    } catch (err) {
      console.error('Failed to activate account:', err);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings, bot configuration, and preferences.
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="bot">Bot Config</TabsTrigger>
            <TabsTrigger value="mt5">MT5 Accounts</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile
                </CardTitle>
                <CardDescription>
                  Update your personal information and profile details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={profile.displayName}
                      onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                      placeholder="Enter your display name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      placeholder="Enter your email"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bot Configuration Tab */}
          <TabsContent value="bot" className="space-y-6">
            {isLoadingConfig ? (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                </CardContent>
              </Card>
            ) : !activeAccount ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <AlertTriangle className="w-12 h-12 mx-auto text-yellow-600" />
                    <p className="text-muted-foreground">
                      No active MT5 account found. Please connect an MT5 account first.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : !botConfig ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <AlertTriangle className="w-12 h-12 mx-auto text-yellow-600" />
                    <p className="text-muted-foreground">
                      Bot configuration not found. Please complete onboarding first.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <SettingsIcon className="w-5 h-5" />
                      Bot Configuration
                    </CardTitle>
                    <CardDescription>
                      Configure your trading bot's risk parameters and trading sessions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {configError && (
                      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {configError}
                      </div>
                    )}

                    {/* Risk Parameters */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Risk Parameters</h3>
                      
                      <div className="space-y-2">
                        <Label htmlFor="risk_percent">Risk Per Trade (%)</Label>
                        <Input
                          id="risk_percent"
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="2.0"
                          value={botConfig.risk_percent}
                          onChange={(e) =>
                            setBotConfig({ ...botConfig, risk_percent: e.target.value })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Recommended: 0.5%. Range: 0.1% - 2.0%
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="risk_reward_ratio">Risk:Reward Ratio</Label>
                        <Input
                          id="risk_reward_ratio"
                          type="number"
                          step="0.1"
                          min="1.0"
                          value={botConfig.risk_reward_ratio}
                          onChange={(e) =>
                            setBotConfig({ ...botConfig, risk_reward_ratio: e.target.value })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Minimum: 1.0. Recommended: 1.2
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="stop_loss_min">Stop Loss Min (%)</Label>
                          <Input
                            id="stop_loss_min"
                            type="number"
                            step="0.01"
                            value={botConfig.stop_loss_range.min}
                            onChange={(e) =>
                              setBotConfig({
                                ...botConfig,
                                stop_loss_range: {
                                  ...botConfig.stop_loss_range,
                                  min: parseFloat(e.target.value),
                                },
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="stop_loss_preferred">Preferred (%)</Label>
                          <Input
                            id="stop_loss_preferred"
                            type="number"
                            step="0.01"
                            value={botConfig.stop_loss_range.preferred}
                            onChange={(e) =>
                              setBotConfig({
                                ...botConfig,
                                stop_loss_range: {
                                  ...botConfig.stop_loss_range,
                                  preferred: parseFloat(e.target.value),
                                },
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="stop_loss_max">Max (%)</Label>
                          <Input
                            id="stop_loss_max"
                            type="number"
                            step="0.01"
                            value={botConfig.stop_loss_range.max}
                            onChange={(e) =>
                              setBotConfig({
                                ...botConfig,
                                stop_loss_range: {
                                  ...botConfig.stop_loss_range,
                                  max: parseFloat(e.target.value),
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Trading Sessions */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Trading Sessions</h3>
                      <p className="text-sm text-muted-foreground">
                        Select the time windows when the bot should trade (GMT).
                      </p>
                      
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Prime Sessions</p>
                          <div className="space-y-2">
                            {PRIME_SESSIONS.map((session) => (
                              <label
                                key={`${session.start}-${session.end}`}
                                className="flex items-center gap-2 p-2 rounded-md border hover:bg-accent cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={botConfig.trading_sessions.some(
                                    (s) => s.start === session.start && s.end === session.end
                                  )}
                                  onChange={() => handleSessionToggle(session)}
                                  className="rounded"
                                />
                                <span className="text-sm">
                                  {session.start} - {session.end} GMT
                                </span>
                                <Badge variant="default" className="ml-auto">Prime</Badge>
                              </label>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium mb-2">Acceptable Sessions</p>
                          <div className="space-y-2">
                            {ACCEPTABLE_SESSIONS.map((session) => (
                              <label
                                key={`${session.start}-${session.end}`}
                                className="flex items-center gap-2 p-2 rounded-md border hover:bg-accent cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={botConfig.trading_sessions.some(
                                    (s) => s.start === session.start && s.end === session.end
                                  )}
                                  onChange={() => handleSessionToggle(session)}
                                  className="rounded"
                                />
                                <span className="text-sm">
                                  {session.start} - {session.end} GMT
                                </span>
                                <Badge variant="secondary" className="ml-auto">Acceptable</Badge>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        onClick={handleSaveBotConfig} 
                        disabled={isSavingConfig || botConfig.trading_sessions.length === 0}
                      >
                        {isSavingConfig ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Configuration'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* MT5 Accounts Tab */}
          <TabsContent value="mt5" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  MT5 Account Management
                </CardTitle>
                <CardDescription>
                  View and manage your connected MT5 accounts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {accounts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">No MT5 accounts connected</p>
                    <Button onClick={() => window.location.href = '/onboarding'}>
                      Connect Account
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {accounts.map((account) => (
                      <Card key={account.id} className={account.is_active ? 'border-primary' : ''}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">
                                  {account.broker_name || account.server}
                                </p>
                                {account.is_active && (
                                  <Badge variant="default">Active</Badge>
                                )}
                                <Badge
                                  variant={
                                    account.connection_status === 'connected'
                                      ? 'default'
                                      : account.connection_status === 'error'
                                      ? 'destructive'
                                      : 'secondary'
                                  }
                                >
                                  {account.connection_status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Server: {account.server}
                              </p>
                              {account.last_connection_test && (
                                <p className="text-xs text-muted-foreground">
                                  Last tested: {new Date(account.last_connection_test).toLocaleString()}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {!account.is_active && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleActivateAccount(account.id)}
                                >
                                  Activate
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTestConnection(account.id)}
                                disabled={testingAccountId === account.id}
                              >
                                {testingAccountId === account.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Testing...
                                  </>
                                ) : (
                                  'Test Connection'
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Configure when and how you receive notifications.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-notifications">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive email alerts for important events
                      </p>
                    </div>
                    <Switch id="email-notifications" />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <Label>Notification Types</Label>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="trade-executions">Trade Executions</Label>
                        <p className="text-sm text-muted-foreground">
                          Notify when trades are opened or closed
                        </p>
                      </div>
                      <Switch id="trade-executions" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="circuit-breaker">Circuit Breaker Events</Label>
                        <p className="text-sm text-muted-foreground">
                          Notify when circuit breaker activates
                        </p>
                      </div>
                      <Switch id="circuit-breaker" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="daily-summary">Daily Summary</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive daily trading performance summary
                        </p>
                      </div>
                      <Switch id="daily-summary" />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button>Save Preferences</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 