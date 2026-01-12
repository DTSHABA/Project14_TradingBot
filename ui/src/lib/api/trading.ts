import { fetchWithAuth } from '../serverComm';
import type { TradingSignal, Trade, CircuitBreakerEvent } from '@/types/trading';

const API_BASE = '/api/v1/protected/trading';

export interface GetSignalsParams {
  limit?: number;
  offset?: number;
  mt5_account_id?: string;
  signal_type?: 'BUY' | 'SELL' | 'HOLD';
  date_from?: string;
  date_to?: string;
}

export interface GetTradesParams {
  limit?: number;
  offset?: number;
  mt5_account_id?: string;
  direction?: 'BUY' | 'SELL';
  date_from?: string;
  date_to?: string;
  outcome?: 'win' | 'loss';
}

export async function getSignals(params: GetSignalsParams = {}): Promise<{
  signals: TradingSignal[];
  pagination: { limit: number; offset: number; total: number };
}> {
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.offset) queryParams.set('offset', params.offset.toString());
  if (params.mt5_account_id) queryParams.set('mt5_account_id', params.mt5_account_id);
  if (params.signal_type) queryParams.set('signal_type', params.signal_type);
  if (params.date_from) queryParams.set('date_from', params.date_from);
  if (params.date_to) queryParams.set('date_to', params.date_to);

  const response = await fetchWithAuth(`${API_BASE}/signals?${queryParams.toString()}`);
  return response.json();
}

export async function getTrades(params: GetTradesParams = {}): Promise<{
  trades: Trade[];
  pagination: { limit: number; offset: number; total: number };
}> {
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.offset) queryParams.set('offset', params.offset.toString());
  if (params.mt5_account_id) queryParams.set('mt5_account_id', params.mt5_account_id);
  if (params.direction) queryParams.set('direction', params.direction);
  if (params.date_from) queryParams.set('date_from', params.date_from);
  if (params.date_to) queryParams.set('date_to', params.date_to);
  if (params.outcome) queryParams.set('outcome', params.outcome);
  
  // Add cache-busting timestamp
  queryParams.set('_t', Date.now().toString());

  const response = await fetchWithAuth(`${API_BASE}/trades?${queryParams.toString()}`);
  return response.json();
}

export async function getTradeDetails(tradeId: string): Promise<Trade> {
  const response = await fetchWithAuth(`${API_BASE}/trades/${tradeId}`);
  return response.json();
}

export async function exportTrades(params: {
  mt5_account_id?: string;
  date_from?: string;
  date_to?: string;
}): Promise<Blob> {
  const queryParams = new URLSearchParams();
  if (params.mt5_account_id) queryParams.set('mt5_account_id', params.mt5_account_id);
  if (params.date_from) queryParams.set('date_from', params.date_from);
  if (params.date_to) queryParams.set('date_to', params.date_to);

  const response = await fetchWithAuth(`${API_BASE}/export-trades?${queryParams.toString()}`);
  return response.blob();
}

export async function getCircuitBreakerEvents(params: {
  limit?: number;
  offset?: number;
  mt5_account_id?: string;
} = {}): Promise<CircuitBreakerEvent[]> {
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.offset) queryParams.set('offset', params.offset.toString());
  if (params.mt5_account_id) queryParams.set('mt5_account_id', params.mt5_account_id);

  const response = await fetchWithAuth(`${API_BASE}/circuit-breaker-events?${queryParams.toString()}`);
  return response.json();
}

