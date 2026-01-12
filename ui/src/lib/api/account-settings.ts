import { fetchWithAuth } from '../serverComm';
import type { AccountSettings } from '@/types/trading';

const API_BASE = '/api/v1/protected/account-settings';

export async function getAccountSettings(): Promise<AccountSettings> {
  const response = await fetchWithAuth(API_BASE);
  return response.json();
}

export async function updateAccountSettings(
  data: Partial<AccountSettings>
): Promise<AccountSettings> {
  const response = await fetchWithAuth(API_BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function changePassword(data: {
  current_password: string;
  new_password: string;
}): Promise<void> {
  await fetchWithAuth(`${API_BASE}/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

