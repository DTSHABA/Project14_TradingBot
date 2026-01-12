import { useState, useCallback, useEffect } from 'react';
import * as mt5Api from '@/lib/api/mt5';
import type { MT5Account, NewMT5Account, ConnectionTestResult } from '@/types/trading';

interface UseMT5ConnectionReturn {
  accounts: MT5Account[];
  isLoading: boolean;
  error: Error | null;
  testConnection: (accountId: string) => Promise<ConnectionTestResult>;
  createAccount: (data: NewMT5Account) => Promise<MT5Account>;
  updateAccount: (accountId: string, data: { server?: string; broker_name?: string }) => Promise<MT5Account>;
  deleteAccount: (accountId: string) => Promise<void>;
  activateAccount: (accountId: string) => Promise<void>;
  refreshAccounts: () => Promise<void>;
}

export function useMT5Connection(): UseMT5ConnectionReturn {
  const [accounts, setAccounts] = useState<MT5Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refreshAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await mt5Api.getMT5Accounts();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch accounts'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const testConnection = useCallback(async (accountId: string): Promise<ConnectionTestResult> => {
    try {
      setError(null);
      return await mt5Api.testMT5Connection(accountId);
    } catch (err) {
      // Preserve the original error message if it's an Error instance
      const error = err instanceof Error ? err : new Error('Failed to test connection');
      setError(error);
      throw error;
    }
  }, []);

  const createAccount = useCallback(async (data: NewMT5Account): Promise<MT5Account> => {
    try {
      setError(null);
      const account = await mt5Api.createMT5Account(data);
      await refreshAccounts();
      return account;
    } catch (err) {
      // Preserve the original error message if it's an Error instance
      const error = err instanceof Error ? err : new Error('Failed to create account');
      setError(error);
      throw error;
    }
  }, [refreshAccounts]);

  const updateAccount = useCallback(async (
    accountId: string,
    data: { server?: string; broker_name?: string }
  ): Promise<MT5Account> => {
    try {
      setError(null);
      const account = await mt5Api.updateMT5Account(accountId, data);
      await refreshAccounts();
      return account;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update account');
      setError(error);
      throw error;
    }
  }, [refreshAccounts]);

  const deleteAccount = useCallback(async (accountId: string): Promise<void> => {
    try {
      setError(null);
      await mt5Api.deleteMT5Account(accountId);
      await refreshAccounts();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete account');
      setError(error);
      throw error;
    }
  }, [refreshAccounts]);

  const activateAccount = useCallback(async (accountId: string): Promise<void> => {
    try {
      setError(null);
      await mt5Api.activateMT5Account(accountId);
      await refreshAccounts();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to activate account');
      setError(error);
      throw error;
    }
  }, [refreshAccounts]);

  // Automatically fetch accounts on mount
  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  return {
    accounts,
    isLoading,
    error,
    testConnection,
    createAccount,
    updateAccount,
    deleteAccount,
    activateAccount,
    refreshAccounts,
  };
}

