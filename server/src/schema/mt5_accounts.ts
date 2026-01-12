import { pgTable, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { appSchema, users } from './users';

export const connectionStatusEnum = pgEnum('connection_status', ['connected', 'disconnected', 'error', 'paused']);

export const mt5Accounts = appSchema.table('mt5_accounts', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  account_number: text('account_number').notNull(), // Encrypted
  password: text('password').notNull(), // Encrypted
  server: text('server').notNull(),
  broker_name: text('broker_name'),
  is_active: boolean('is_active').default(false).notNull(),
  connection_status: connectionStatusEnum('connection_status').default('disconnected').notNull(),
  last_connection_test: timestamp('last_connection_test'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export type MT5Account = typeof mt5Accounts.$inferSelect;
export type NewMT5Account = typeof mt5Accounts.$inferInsert;

