import { fetchWithAuth } from '../serverComm';
import type { MT5Account, NewMT5Account, ConnectionTestResult, MT5LiveAccountInfo } from '@/types/trading';

const API_BASE = '/api/v1/protected/mt5';

export async function createMT5Account(data: NewMT5Account): Promise<MT5Account> {
  const response = await fetchWithAuth(`${API_BASE}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getMT5Accounts(): Promise<MT5Account[]> {
  const response = await fetchWithAuth(`${API_BASE}/accounts`);
  return response.json();
}

export async function getMT5Account(id: string): Promise<MT5Account> {
  const response = await fetchWithAuth(`${API_BASE}/accounts/${id}`);
  return response.json();
}

export async function testMT5Connection(accountId: string): Promise<ConnectionTestResult> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/accounts/${accountId}/test`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    // Re-throw with more context if it's a network error
    if (error instanceof Error && 'status' in error && (error as any).status === 0) {
      throw new Error(`Unable to connect to server. Please ensure the server is running. ${error.message}`);
    }
    throw error;
  }
}

export async function updateMT5Account(
  accountId: string,
  data: { server?: string; broker_name?: string }
): Promise<MT5Account> {
  const response = await fetchWithAuth(`${API_BASE}/accounts/${accountId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function deleteMT5Account(accountId: string): Promise<void> {
  await fetchWithAuth(`${API_BASE}/accounts/${accountId}`, {
    method: 'DELETE',
  });
}

export async function activateMT5Account(accountId: string): Promise<{ success: boolean; is_active: boolean }> {
  const response = await fetchWithAuth(`${API_BASE}/accounts/${accountId}/activate`, {
    method: 'POST',
  });
  return response.json();
}

export async function getMT5LiveAccountInfo(): Promise<MT5LiveAccountInfo> {
  const response = await fetchWithAuth(`${API_BASE}/live-account-info`);
  return response.json();
}

