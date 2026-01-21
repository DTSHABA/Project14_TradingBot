import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MT5ConnectionWizard } from '@/components/mt5/MT5ConnectionWizard';
import { useMT5Connection } from '@/hooks/useMT5Connection';
import { createBotConfig } from '@/lib/api/bot-config';
import type { NewBotConfig, TradingSession } from '@/types/trading';

const PRIME_SESSIONS: TradingSession[] = [
  { start: '08:00', end: '09:30', type: 'prime' },
  { start: '13:00', end: '15:00', type: 'prime' },
  { start: '14:30', end: '15:30', type: 'prime' },
];

const ACCEPTABLE_SESSIONS: TradingSession[] = [
  { start: '09:30', end: '13:00', type: 'acceptable' },
  { start: '15:30', end: '17:00', type: 'acceptable' },
];

export function Onboarding() {
  const navigate = useNavigate();
  const { accounts, refreshAccounts, isLoading } = useMT5Connection();
  const hasCheckedAccounts = useRef(false);
  const [step, setStep] = useState(1);
  const [mt5AccountId, setMt5AccountId] = useState<string | null>(null);
  const [botConfig, setBotConfig] = useState<Partial<NewBotConfig>>({
    risk_percent: 0.5,
    stop_loss_range: { min: 0.25, max: 0.40, preferred: 0.30 },
    risk_reward_ratio: 1.2,
    trading_sessions: [],
  });
  const [isCreatingConfig, setIsCreatingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user already has accounts and redirect to dashboard
  useEffect(() => {
    if (!hasCheckedAccounts.current && !isLoading) {
      hasCheckedAccounts.current = true;
      refreshAccounts();
    }
  }, [refreshAccounts, isLoading]);

  // Redirect to dashboard if user already has accounts
  useEffect(() => {
    if (!isLoading && accounts.length > 0) {
      navigate('/dashboard');
    }
  }, [accounts, isLoading, navigate]);

  const handleMT5Success = (accountId: string) => {
    setMt5AccountId(accountId);
    setStep(3); // Skip email verification step for now
  };

  const handleSessionToggle = (session: TradingSession) => {
    setBotConfig((prev) => {
      const sessions = prev.trading_sessions || [];
      const exists = sessions.some(
        (s) => s.start === session.start && s.end === session.end
      );
      return {
        ...prev,
        trading_sessions: exists
          ? sessions.filter((s) => s.start !== session.start || s.end !== session.end)
          : [...sessions, session],
      };
    });
  };

  const handleCreateConfig = async () => {
    if (!mt5AccountId || !botConfig.trading_sessions || botConfig.trading_sessions.length === 0) {
      setError('Please select at least one trading session');
      return;
    }

    setIsCreatingConfig(true);
    setError(null);

    try {
      await createBotConfig({
        mt5_account_id: mt5AccountId,
        risk_percent: botConfig.risk_percent || 0.5,
        stop_loss_range: botConfig.stop_loss_range || { min: 0.25, max: 0.40, preferred: 0.30 },
        risk_reward_ratio: botConfig.risk_reward_ratio || 1.2,
        trading_sessions: botConfig.trading_sessions,
      });

      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bot configuration');
    } finally {
      setIsCreatingConfig(false);
    }
  };

  if (step === 1) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to Scalping Bot</CardTitle>
            <CardDescription>
              Let's get you set up. First, connect your MT5 account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setStep(2)} className="w-full">
              Get Started
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <MT5ConnectionWizard onSuccess={handleMT5Success} onBack={() => setStep(1)} />
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Configure Your Bot</CardTitle>
            <CardDescription>Set up your trading parameters and sessions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                  setBotConfig((prev) => ({ ...prev, risk_percent: parseFloat(e.target.value) }))
                }
              />
              <p className="text-xs text-muted-foreground">Recommended: 0.5%</p>
            </div>

            <div className="space-y-2">
              <Label>Trading Sessions</Label>
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium mb-2">Prime Sessions</p>
                  {PRIME_SESSIONS.map((session) => (
                    <label key={`${session.start}-${session.end}`} className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={botConfig.trading_sessions?.some(
                          (s) => s.start === session.start && s.end === session.end
                        )}
                        onChange={() => handleSessionToggle(session)}
                      />
                      <span className="text-sm">
                        {session.start} - {session.end} GMT
                      </span>
                    </label>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Acceptable Sessions</p>
                  {ACCEPTABLE_SESSIONS.map((session) => (
                    <label key={`${session.start}-${session.end}`} className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={botConfig.trading_sessions?.some(
                          (s) => s.start === session.start && s.end === session.end
                        )}
                        onChange={() => handleSessionToggle(session)}
                      />
                      <span className="text-sm">
                        {session.start} - {session.end} GMT
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                onClick={handleCreateConfig}
                disabled={isCreatingConfig || !botConfig.trading_sessions || botConfig.trading_sessions.length === 0}
                className="ml-auto"
              >
                {isCreatingConfig ? 'Creating...' : 'Complete Setup'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

