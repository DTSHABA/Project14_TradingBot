-- Complete database schema for the app
-- This creates all tables in the 'app' schema

-- Create ENUM types (drop if they exist to handle re-runs)
DO $$ BEGIN
  CREATE TYPE "app"."connection_status" AS ENUM ('connected', 'disconnected', 'error', 'paused');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "app"."signal_type" AS ENUM ('BUY', 'SELL', 'HOLD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "app"."trade_direction" AS ENUM ('BUY', 'SELL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "app"."circuit_breaker_event_type" AS ENUM ('halt', 'reset', 'risk_adjustment');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create users table (in app schema)
CREATE TABLE IF NOT EXISTS "app"."users" (
  "id" text PRIMARY KEY,
  "email" text UNIQUE,
  "display_name" text,
  "photo_url" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create mt5_accounts table
CREATE TABLE IF NOT EXISTS "app"."mt5_accounts" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
  "account_number" text NOT NULL,
  "password" text NOT NULL,
  "server" text NOT NULL,
  "broker_name" text,
  "is_active" boolean NOT NULL DEFAULT false,
  "connection_status" "app"."connection_status" NOT NULL DEFAULT 'disconnected',
  "last_connection_test" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create bot_configs table
CREATE TABLE IF NOT EXISTS "app"."bot_configs" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
  "mt5_account_id" text NOT NULL REFERENCES "app"."mt5_accounts"("id") ON DELETE CASCADE,
  "risk_percent" decimal(5, 2) NOT NULL DEFAULT '0.50',
  "stop_loss_range" jsonb NOT NULL DEFAULT '{"min": 0.25, "max": 0.40, "preferred": 0.30}',
  "risk_reward_ratio" decimal(5, 2) NOT NULL DEFAULT '1.20',
  "trading_sessions" jsonb NOT NULL DEFAULT '[]',
  "is_trading_active" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create trading_signals table
CREATE TABLE IF NOT EXISTS "app"."trading_signals" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
  "mt5_account_id" text NOT NULL REFERENCES "app"."mt5_accounts"("id") ON DELETE CASCADE,
  "signal_type" "app"."signal_type" NOT NULL,
  "confidence" decimal(5, 2) NOT NULL,
  "timestamp" timestamp NOT NULL DEFAULT now(),
  "price" decimal(10, 2) NOT NULL,
  "reason" text,
  "became_trade" boolean NOT NULL DEFAULT false,
  "rejection_reason" text
);

-- Create trades table
CREATE TABLE IF NOT EXISTS "app"."trades" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
  "mt5_account_id" text NOT NULL REFERENCES "app"."mt5_accounts"("id") ON DELETE CASCADE,
  "signal_id" text REFERENCES "app"."trading_signals"("id") ON DELETE SET NULL,
  "ticket" integer NOT NULL,
  "direction" "app"."trade_direction" NOT NULL,
  "entry_price" decimal(10, 2) NOT NULL,
  "exit_price" decimal(10, 2),
  "lot_size" decimal(10, 2) NOT NULL,
  "stop_loss" decimal(10, 2) NOT NULL,
  "take_profit" decimal(10, 2) NOT NULL,
  "entry_time" timestamp NOT NULL DEFAULT now(),
  "exit_time" timestamp,
  "pnl" decimal(10, 2),
  "hold_time_seconds" integer,
  "exit_reason" text,
  "partial_exits" jsonb DEFAULT '[]',
  UNIQUE("user_id", "mt5_account_id", "ticket")
);

-- Create circuit_breaker_events table
CREATE TABLE IF NOT EXISTS "app"."circuit_breaker_events" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
  "mt5_account_id" text NOT NULL REFERENCES "app"."mt5_accounts"("id") ON DELETE CASCADE,
  "event_type" "app"."circuit_breaker_event_type" NOT NULL,
  "reason" text,
  "halted_until" timestamp,
  "timestamp" timestamp NOT NULL DEFAULT now()
);

-- Create account_settings table
CREATE TABLE IF NOT EXISTS "app"."account_settings" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL UNIQUE REFERENCES "app"."users"("id") ON DELETE CASCADE,
  "timezone" text NOT NULL DEFAULT 'UTC',
  "email_notifications" boolean NOT NULL DEFAULT true,
  "notification_preferences" jsonb NOT NULL DEFAULT '{"trade_executions": true, "circuit_breaker": true, "daily_summary": true}',
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create sessions table for daily trading session tracking
CREATE TABLE IF NOT EXISTS "app"."sessions" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
  "mt5_account_id" text NOT NULL REFERENCES "app"."mt5_accounts"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "start_time" timestamp,
  "end_time" timestamp,
  "trades_count" integer NOT NULL DEFAULT 0,
  "wins" integer NOT NULL DEFAULT 0,
  "losses" integer NOT NULL DEFAULT 0,
  "total_pnl" decimal(10, 2) NOT NULL DEFAULT 0,
  "win_rate" decimal(5, 2),
  "created_at" timestamp NOT NULL DEFAULT now(),
  UNIQUE("user_id", "mt5_account_id", "date")
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_mt5_accounts_user_id" ON "app"."mt5_accounts"("user_id");
CREATE INDEX IF NOT EXISTS "idx_bot_configs_user_id" ON "app"."bot_configs"("user_id");
CREATE INDEX IF NOT EXISTS "idx_bot_configs_mt5_account_id" ON "app"."bot_configs"("mt5_account_id");
CREATE INDEX IF NOT EXISTS "idx_trading_signals_user_id" ON "app"."trading_signals"("user_id");
CREATE INDEX IF NOT EXISTS "idx_trading_signals_mt5_account_id" ON "app"."trading_signals"("mt5_account_id");
CREATE INDEX IF NOT EXISTS "idx_trades_user_id" ON "app"."trades"("user_id");
CREATE INDEX IF NOT EXISTS "idx_trades_mt5_account_id" ON "app"."trades"("mt5_account_id");
CREATE INDEX IF NOT EXISTS "idx_circuit_breaker_events_user_id" ON "app"."circuit_breaker_events"("user_id");
CREATE INDEX IF NOT EXISTS "idx_circuit_breaker_events_mt5_account_id" ON "app"."circuit_breaker_events"("mt5_account_id");
CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "app"."sessions"("user_id");
CREATE INDEX IF NOT EXISTS "idx_sessions_mt5_account_id" ON "app"."sessions"("mt5_account_id");
CREATE INDEX IF NOT EXISTS "idx_sessions_date" ON "app"."sessions"("date");
CREATE INDEX IF NOT EXISTS "idx_trades_ticket" ON "app"."trades"("ticket");
CREATE INDEX IF NOT EXISTS "idx_trades_entry_time" ON "app"."trades"("entry_time");
CREATE INDEX IF NOT EXISTS "idx_trades_exit_time" ON "app"."trades"("exit_time");
CREATE INDEX IF NOT EXISTS "idx_trading_signals_timestamp" ON "app"."trading_signals"("timestamp");

