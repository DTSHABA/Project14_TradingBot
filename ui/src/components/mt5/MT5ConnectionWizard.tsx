import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMT5Connection } from '@/hooks/useMT5Connection';
import type { NewMT5Account, ConnectionTestResult } from '@/types/trading';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500';

const BROKERS = [
  'IC Markets',
  'Pepperstone',
  'FXTM',
  'XM Group',
  'Exness',
  'Other',
];

interface MT5ConnectionWizardProps {
  onSuccess: (accountId: string) => void;
  onBack?: () => void;
}

export function MT5ConnectionWizard({ onSuccess, onBack }: MT5ConnectionWizardProps) {
  const { createAccount, testConnection } = useMT5Connection();
  const [formData, setFormData] = useState<NewMT5Account>({
    account_number: '',
    password: '',
    server: '',
    broker_name: '',
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);

  const handleInputChange = (field: keyof NewMT5Account, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!formData.account_number || !formData.password || !formData.server) {
      setError('Please fill in all required fields');
      return;
    }

    setIsTesting(true);
    setError(null);
    setTestResult(null);

    try {
      // First create the account
      const account = await createAccount(formData);
      setCreatedAccountId(account.id);

      // Then test the connection
      const result = await testConnection(account.id);
      setTestResult(result);

      // Only set error state if testResult doesn't have error info
      // This prevents duplicate error messages
      if (!result.connected && !result.error) {
        setError('Connection failed');
      } else {
        // Clear error state since testResult will display the error
        setError(null);
      }
    } catch (err) {
      let errorMessage = 'Failed to test connection';
      if (err instanceof Error) {
        errorMessage = err.message;
        // Provide more helpful error messages
        if (err.message.includes('Unable to connect to server')) {
          errorMessage = err.message;
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NETWORK_ERROR')) {
          errorMessage = 'Unable to connect to server. Please ensure the server is running and try again.';
        } else if (err.message.includes('Failed to decrypt')) {
          errorMessage = 'Server configuration error. Please contact support.';
        } else if (err.message.includes('Account not found')) {
          errorMessage = 'Account not found. Please try creating the account again.';
        }
      }
      setError(errorMessage);
    } finally {
      setIsTesting(false);
    }
  };

  const handleNext = () => {
    if (createdAccountId && testResult?.connected) {
      onSuccess(createdAccountId);
    } else {
      setError('Please test and verify the connection first');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Your MT5 Account</CardTitle>
        <CardDescription>
          Enter your MetaTrader 5 account credentials to connect your trading account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="broker">Broker</Label>
          <select
            id="broker"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={formData.broker_name || ''}
            onChange={(e) => handleInputChange('broker_name', e.target.value)}
          >
            <option value="">Select a broker</option>
            {BROKERS.map((broker) => (
              <option key={broker} value={broker}>
                {broker}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account_number">Account Number</Label>
          <Input
            id="account_number"
            type="text"
            placeholder="12345678"
            value={formData.account_number}
            onChange={(e) => handleInputChange('account_number', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="server">Server</Label>
          <Input
            id="server"
            type="text"
            placeholder="ICMarkets-Demo"
            value={formData.server}
            onChange={(e) => handleInputChange('server', e.target.value)}
          />
        </div>

        {/* Only show error if testResult is not available or if it's a non-connection error */}
        {error && (!testResult || (testResult && testResult.connected === undefined)) && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive space-y-2">
            <p className="font-medium whitespace-pre-line">{error}</p>
            {(error.includes('Unable to connect') || error.includes('Failed to fetch') || error.includes('NETWORK_ERROR') || error.includes('MT5 API service')) && (
              <div className="mt-2 pt-2 border-t border-destructive/20">
                <p className="text-xs font-medium mb-1">Troubleshooting:</p>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  {error.includes('MT5 API service') && (
                    <>
                      <li>Start the MT5 API service: <code className="bg-destructive/20 px-1 rounded">trading-engine/run_mt5_api.bat</code></li>
                      <li>Ensure MetaTrader 5 terminal is installed</li>
                      <li>Check that port 5001 is not blocked by firewall</li>
                    </>
                  )}
                  {(error.includes('Unable to connect') || error.includes('Failed to fetch') || error.includes('NETWORK_ERROR')) && (
                    <>
                      <li>Ensure the backend server is running</li>
                      <li>Check API URL: {API_BASE_URL}</li>
                      <li>Run <code className="bg-destructive/20 px-1 rounded">pnpm run dev</code> from the project root</li>
                      <li>Check browser console for detailed errors</li>
                    </>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {testResult && (
          <div
            className={`rounded-md p-3 text-sm ${
              testResult.connected
                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {testResult.connected ? (
              <div>
                <p className="font-semibold">Connection successful!</p>
                {testResult.account_info && (
                  <p className="mt-1">
                    Equity: ${testResult.account_info.equity.toFixed(2)} | Balance: $
                    {testResult.account_info.balance.toFixed(2)}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="font-medium">Connection failed: {testResult.error || 'Unknown error'}</p>
                {testResult.error && testResult.error.includes('MT5 API service') && (
                  <div className="mt-2 pt-2 border-t border-destructive/20">
                    <p className="text-xs font-medium mb-1">Troubleshooting:</p>
                    <ul className="text-xs space-y-1 list-disc list-inside">
                      <li>Start the MT5 API service: <code className="bg-destructive/20 px-1 rounded">trading-engine/run_mt5_api.bat</code></li>
                      <li>Ensure MetaTrader 5 terminal is installed</li>
                      <li>Check that port 5001 is not blocked by firewall</li>
                    </ul>
                  </div>
                )}
                {testResult.error && testResult.error.includes('timed out') && (
                  <div className="mt-2 pt-2 border-t border-destructive/20">
                    <p className="text-xs font-medium mb-1">Possible causes:</p>
                    <ul className="text-xs space-y-1 list-disc list-inside">
                      <li>Incorrect account number, password, or server name</li>
                      <li>Server name must match exactly (case-sensitive)</li>
                      <li>Network connectivity issues</li>
                      <li>MT5 terminal may need to be opened and logged in manually first</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <Button
            onClick={handleTestConnection}
            disabled={isTesting || !formData.account_number || !formData.password || !formData.server}
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button
            onClick={handleNext}
            disabled={!testResult?.connected || !createdAccountId}
            className="ml-auto"
          >
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

