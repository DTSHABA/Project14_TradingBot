// MT5 Account Types
export interface MT5Account {
  id: string;
  server: string;
  broker_name: string | null;
  is_active: boolean;
  connection_status: 'connected' | 'disconnected' | 'error' | 'paused';
  last_connection_test: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewMT5Account {
  account_number: string;
  password: string;
  server: string;
  broker_name?: string;
}

export interface ConnectionTestResult {
  connected: boolean;
  account_info?: {
    equity: number;
    balance: number;
    margin?: number;
    margin_free?: number;
    margin_level?: number;
    currency?: string;
  };
  error?: string;
}

export interface MT5LiveAccountInfo {
  connected: boolean;
  account_id: string;
  server: string;
  broker_name: string | null;
  equity: number;
  balance: number;
  margin: number;
  margin_free: number;
  margin_level?: number;
  currency: string;
  last_updated: string;
  error?: string;
}

// Bot Config Types
export interface TradingSession {
  start: string; // "08:00"
  end: string; // "09:30"
  type: string; // "prime", "acceptable"
}

export interface StopLossRange {
  min: number;
  max: number;
  preferred: number;
}

export interface BotConfig {
  id: string;
  user_id: string;
  mt5_account_id: string;
  risk_percent: string;
  stop_loss_range: StopLossRange;
  risk_reward_ratio: string;
  trading_sessions: TradingSession[];
  is_trading_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewBotConfig {
  mt5_account_id: string;
  risk_percent: number;
  stop_loss_range: StopLossRange;
  risk_reward_ratio: number;
  trading_sessions: TradingSession[];
}

// Trading Activity Types
export type SignalType = 'BUY' | 'SELL' | 'HOLD';
export type TradeDirection = 'BUY' | 'SELL';

export interface TradingSignal {
  id: string;
  user_id: string;
  mt5_account_id: string;
  signal_type: SignalType;
  confidence: string;
  timestamp: string;
  price: string;
  reason: string | null;
  became_trade: boolean;
  rejection_reason: string | null;
}

export interface Trade {
  id: string;
  user_id: string;
  mt5_account_id: string;
  signal_id: string | null; // Link to signal that generated this trade
  ticket: number;
  direction: TradeDirection;
  entry_price: string;
  exit_price: string | null;
  lot_size: string;
  stop_loss: string;
  take_profit: string;
  entry_time: string;
  exit_time: string | null;
  pnl: string | null;
  hold_time_seconds: number | null;
  exit_reason: string | null;
  partial_exits: Array<{
    percent: number;
    price: number;
    time: string;
  }>;
}

export interface CircuitBreakerEvent {
  id: string;
  user_id: string;
  mt5_account_id: string;
  event_type: 'halt' | 'reset' | 'risk_adjustment';
  reason: string | null;
  halted_until: string | null;
  timestamp: string;
}

// Dashboard Types
export interface DashboardStatus {
  equity?: number; // Optional - only present if we can get real equity from MT5
  equity_error?: string; // Error message if we couldn't get equity
  daily_pnl: {
    amount: number;
    percent?: number; // Optional - only present if we have starting balance
  };
  open_position: Trade | null;
  bot_status: 'active' | 'paused' | 'inactive' | 'error';
  today_stats: {
    trades: number;
    win_rate: number;
    avg_hold_time: number;
  };
  connection_status: string;
}

export interface ActivityEvent {
  id: string;
  type: 'signal' | 'trade' | 'circuit_breaker';
  event_type: string;
  message: string;
  timestamp: string | Date;
}

export interface ActivityFeedResponse {
  events: ActivityEvent[];
  last_timestamp: string | null;
}

// Analytics Types
export interface PerformanceMetrics {
  total_trades: number;
  win_rate: number;
  profit_factor: number;
  avg_win: number;
  avg_loss: number;
  largest_win: number;
  largest_loss: number;
  avg_hold_time: number;
  max_hold_time: number;
  sharpe_ratio: number;
  max_drawdown: number;
  best_day: { date: string; pnl: number } | null;
  worst_day: { date: string; pnl: number } | null;
}

export interface TimeAnalysis {
  by_hour: Array<{
    hour: number;
    trades: number;
    win_rate: number;
    pnl: number;
  }>;
  by_day_of_week: Array<{
    day: string;
    trades: number;
    win_rate: number;
    pnl: number;
  }>;
  by_session: Array<{
    session: string;
    trades: number;
    win_rate: number;
    pnl: number;
  }>;
}

export interface SignalAnalysis {
  total_signals: number;
  approval_rate: number;
  rejection_reasons: Array<{
    reason: string;
    count: number;
  }>;
  confidence_vs_outcome: Array<{
    confidence_range: string;
    win_rate: number;
    trades: number;
  }>;
}

// Account Settings Types
export interface AccountSettings {
  id?: string;
  user_id?: string;
  timezone: string;
  email_notifications: boolean;
  notification_preferences: {
    trade_executions: boolean;
    circuit_breaker: boolean;
    daily_summary: boolean;
  };
  updated_at?: string;
}

