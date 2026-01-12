import { fetchWithAuth } from '../serverComm';
import type { BotConfig, NewBotConfig } from '@/types/trading';

const API_BASE = '/api/v1/protected/bot-config';

export async function createBotConfig(data: NewBotConfig): Promise<BotConfig> {
  const response = await fetchWithAuth(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getBotConfig(mt5AccountId: string): Promise<BotConfig> {
  const response = await fetchWithAuth(`${API_BASE}/${mt5AccountId}`);
  return response.json();
}

export async function updateBotConfig(
  configId: string,
  data: Partial<NewBotConfig>
): Promise<BotConfig> {
  const response = await fetchWithAuth(`${API_BASE}/${configId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function toggleTrading(configId: string): Promise<{ is_trading_active: boolean }> {
  const response = await fetchWithAuth(`${API_BASE}/${configId}/toggle-trading`, {
    method: 'POST',
  });
  return response.json();
}

