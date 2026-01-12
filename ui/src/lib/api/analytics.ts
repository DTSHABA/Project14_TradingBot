import { fetchWithAuth } from '../serverComm';
import type { PerformanceMetrics, TimeAnalysis, SignalAnalysis } from '@/types/trading';

const API_BASE = '/api/v1/protected/analytics';

export async function getPerformanceMetrics(params: {
  mt5_account_id?: string;
  date_from?: string;
  date_to?: string;
} = {}): Promise<PerformanceMetrics> {
  const queryParams = new URLSearchParams();
  if (params.mt5_account_id) queryParams.set('mt5_account_id', params.mt5_account_id);
  if (params.date_from) queryParams.set('date_from', params.date_from);
  if (params.date_to) queryParams.set('date_to', params.date_to);
  
  // Add cache-busting timestamp
  queryParams.set('_t', Date.now().toString());

  const response = await fetchWithAuth(`${API_BASE}/performance-metrics?${queryParams.toString()}`);
  return response.json();
}

export async function getTimeAnalysis(params: {
  mt5_account_id?: string;
  period?: 'day' | 'week' | 'month';
} = {}): Promise<TimeAnalysis> {
  const queryParams = new URLSearchParams();
  if (params.mt5_account_id) queryParams.set('mt5_account_id', params.mt5_account_id);
  if (params.period) queryParams.set('period', params.period);
  
  // Add cache-busting timestamp
  queryParams.set('_t', Date.now().toString());

  const response = await fetchWithAuth(`${API_BASE}/time-analysis?${queryParams.toString()}`);
  return response.json();
}

export async function getSignalAnalysis(params: {
  mt5_account_id?: string;
  date_from?: string;
  date_to?: string;
} = {}): Promise<SignalAnalysis> {
  const queryParams = new URLSearchParams();
  if (params.mt5_account_id) queryParams.set('mt5_account_id', params.mt5_account_id);
  if (params.date_from) queryParams.set('date_from', params.date_from);
  if (params.date_to) queryParams.set('date_to', params.date_to);
  
  // Add cache-busting timestamp
  queryParams.set('_t', Date.now().toString());

  const response = await fetchWithAuth(`${API_BASE}/signal-analysis?${queryParams.toString()}`);
  return response.json();
}

