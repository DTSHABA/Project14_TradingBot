import { pgTable, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { appSchema, users } from './users';

export const accountSettings = appSchema.table('account_settings', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  user_id: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  timezone: text('timezone').default('UTC').notNull(),
  email_notifications: boolean('email_notifications').default(true).notNull(),
  notification_preferences: jsonb('notification_preferences').$type<{
    trade_executions: boolean;
    circuit_breaker: boolean;
    daily_summary: boolean;
  }>().default({
    trade_executions: true,
    circuit_breaker: true,
    daily_summary: true,
  }).notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export type AccountSettings = typeof accountSettings.$inferSelect;
export type NewAccountSettings = typeof accountSettings.$inferInsert;

