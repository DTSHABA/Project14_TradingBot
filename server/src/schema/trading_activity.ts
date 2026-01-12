import { pgTable, text, timestamp, boolean, decimal, integer, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { appSchema, users } from './users';
import { mt5Accounts } from './mt5_accounts';

export const signalTypeEnum = pgEnum('signal_type', ['BUY', 'SELL', 'HOLD']);
export const tradeDirectionEnum = pgEnum('trade_direction', ['BUY', 'SELL']);
export const circuitBreakerEventTypeEnum = pgEnum('circuit_breaker_event_type', ['halt', 'reset', 'risk_adjustment']);

export const tradingSignals = appSchema.table('trading_signals', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mt5_account_id: text('mt5_account_id').notNull().references(() => mt5Accounts.id, { onDelete: 'cascade' }),
  signal_type: signalTypeEnum('signal_type').notNull(),
  confidence: decimal('confidence', { precision: 5, scale: 2 }).notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  reason: text('reason'),
  became_trade: boolean('became_trade').default(false).notNull(),
  rejection_reason: text('rejection_reason'),
});

export const trades = appSchema.table('trades', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mt5_account_id: text('mt5_account_id').notNull().references(() => mt5Accounts.id, { onDelete: 'cascade' }),
  signal_id: text('signal_id').references(() => tradingSignals.id, { onDelete: 'set null' }), // Link to signal that generated this trade
  ticket: integer('ticket').notNull().$type<number>(), // Actually BIGINT in DB, but drizzle uses integer() for bigint
  direction: tradeDirectionEnum('direction').notNull(),
  entry_price: decimal('entry_price', { precision: 10, scale: 2 }).notNull(),
  exit_price: decimal('exit_price', { precision: 10, scale: 2 }),
  lot_size: decimal('lot_size', { precision: 10, scale: 2 }).notNull(),
  stop_loss: decimal('stop_loss', { precision: 10, scale: 2 }).notNull(),
  take_profit: decimal('take_profit', { precision: 10, scale: 2 }).notNull(),
  entry_time: timestamp('entry_time').defaultNow().notNull(),
  exit_time: timestamp('exit_time'),
  pnl: decimal('pnl', { precision: 10, scale: 2 }),
  hold_time_seconds: integer('hold_time_seconds'),
  exit_reason: text('exit_reason'), // 'take_profit', 'stop_loss', 'time_limit', 'momentum_reversal', 'force_close'
  partial_exits: jsonb('partial_exits').$type<Array<{ percent: number; price: number; time: string }>>().default([]),
});

export const circuitBreakerEvents = appSchema.table('circuit_breaker_events', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mt5_account_id: text('mt5_account_id').notNull().references(() => mt5Accounts.id, { onDelete: 'cascade' }),
  event_type: circuitBreakerEventTypeEnum('event_type').notNull(),
  reason: text('reason'),
  halted_until: timestamp('halted_until'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const sessions = appSchema.table('sessions', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mt5_account_id: text('mt5_account_id').notNull().references(() => mt5Accounts.id, { onDelete: 'cascade' }),
  date: timestamp('date', { mode: 'date' }).notNull(),
  start_time: timestamp('start_time'),
  end_time: timestamp('end_time'),
  trades_count: integer('trades_count').default(0).notNull(),
  wins: integer('wins').default(0).notNull(),
  losses: integer('losses').default(0).notNull(),
  total_pnl: decimal('total_pnl', { precision: 10, scale: 2 }).default('0').notNull(),
  win_rate: decimal('win_rate', { precision: 5, scale: 2 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export type TradingSignal = typeof tradingSignals.$inferSelect;
export type NewTradingSignal = typeof tradingSignals.$inferInsert;
export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
export type CircuitBreakerEvent = typeof circuitBreakerEvents.$inferSelect;
export type NewCircuitBreakerEvent = typeof circuitBreakerEvents.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

