import { pgTable, text, timestamp, boolean, decimal, jsonb } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { appSchema, users } from './users';
import { mt5Accounts } from './mt5_accounts';

export const botConfigs = appSchema.table('bot_configs', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mt5_account_id: text('mt5_account_id').notNull().references(() => mt5Accounts.id, { onDelete: 'cascade' }),
  risk_percent: decimal('risk_percent', { precision: 5, scale: 2 }).default('0.50').notNull(),
  stop_loss_range: jsonb('stop_loss_range').$type<{ min: number; max: number; preferred: number }>().default({ min: 0.25, max: 0.40, preferred: 0.30 }).notNull(),
  risk_reward_ratio: decimal('risk_reward_ratio', { precision: 5, scale: 2 }).default('1.20').notNull(),
  trading_sessions: jsonb('trading_sessions').$type<Array<{ start: string; end: string; type: string }>>().default([]).notNull(),
  is_trading_active: boolean('is_trading_active').default(false).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export type BotConfig = typeof botConfigs.$inferSelect;
export type NewBotConfig = typeof botConfigs.$inferInsert;

