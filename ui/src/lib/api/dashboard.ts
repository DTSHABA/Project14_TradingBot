import { fetchWithAuth } from '../serverComm';
import type { DashboardStatus, ActivityFeedResponse } from '@/types/trading';

const API_BASE = '/api/v1/protected/dashboard';

export async function getDashboardStatus(): Promise<DashboardStatus> {
  const response = await fetchWithAuth(`${API_BASE}/status`);
  return response.json();
}

export async function getActivityFeed(params: {
  limit?: number;
  since?: string;
} = {}): Promise<ActivityFeedResponse> {
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.since) queryParams.set('since', params.since);

  const response = await fetchWithAuth(`${API_BASE}/activity-feed?${queryParams.toString()}`);
  return response.json();
}

export async function forceClosePosition(mt5AccountId: string): Promise<{ success: boolean }> {
  const response = await fetchWithAuth(`${API_BASE}/force-close-position`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mt5_account_id: mt5AccountId }),
  });
  return response.json();
}

export async function resetCircuitBreaker(mt5AccountId: string): Promise<{ success: boolean }> {
  const response = await fetchWithAuth(`${API_BASE}/reset-circuit-breaker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mt5_account_id: mt5AccountId }),
  });
  return response.json();
}

