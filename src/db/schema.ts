import {
  boolean,
  integer,
  json,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// Core Better Auth schema. Keep in sync with `auth.api` expectations.
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const category = pgTable('category', {
  id: text('id').primaryKey(),
  // NULL user_id = built-in category, shared by everyone and not editable.
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  icon: text('icon').notNull(), // see CATEGORY_ICONS in lib/utils/design.ts
  color: text('color').notNull(), // hex
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const merchantRule = pgTable(
  'merchant_rule',
  {
    id: text('id').primaryKey(),
    // NULL user_id = built-in seed rule, shared by everyone. A user rule with
    // the same key overrides the seed.
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    key: text('key').notNull(), // merchantCore(title), see lib/utils/categorize.ts
    categoryId: text('category_id')
      .notNull()
      .references(() => category.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('merchant_rule_user_key_idx').on(table.userId, table.key)],
)

export const expense = pgTable(
  'expense',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => category.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    payee: text('payee'),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    // Manual | qr | line_text | line_voice | line_slip (voice/slip reserved).
    source: text('source').notNull().default('manual'),
    qrPayload: text('qr_payload'),
    externalId: text('external_id'), // slip transaction id, for dedupe
    // expense | income; anything that adds money (salary, refunds) is income.
    type: text('type').notNull().default('expense'),
    // Extra detail from a memo, e.g. "ไม่ใส่ผัก" — displayed source text never lives here.
    note: text('note'),
    // The message text the entry came from (LINE memo only).
    rawText: text('raw_text'),
    // Soft delete: LINE "ลบล่าสุด" marks this instead of removing the row.
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('expense_user_external_idx').on(table.userId, table.externalId)],
)

// LINE webhook events, one row per event id. The webhook inserts each event and
// skips it when the id already exists, which is what makes LINE retries a no-op.
export const lineEvent = pgTable('line_event', {
  id: text('id').primaryKey(),
  webhookEventId: text('webhook_event_id').notNull().unique(),
  type: text('type').notNull(),
  payload: json('payload').notNull(),
  // received | processed | failed
  status: text('status').notNull().default('received'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const lineLink = pgTable('line_link', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  lineUserId: text('line_user_id').notNull().unique(),
  linkedAt: timestamp('linked_at').defaultNow().notNull(),
})

// Short-lived six-character link code. Used once by marking used_at; old unused
// codes are dropped whenever a fresh one is created.
export const lineLinkCode = pgTable('line_link_code', {
  code: text('code').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// A slip-batch import runs in the background so the user can close the dialog
// (or the tab). Rows persist progress; `src/server/import-worker.ts` drives them and
// resumes a job left running if the server restarts. The uploaded images live
// in .data/imports/<id>/ until the job finishes.
export const importJob = pgTable('import_job', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // pending | processing | done | failed
  total: integer('total').notNull(),
  processed: integer('processed').notNull().default(0),
  imported: integer('imported').notNull().default(0),
  skipped: integer('skipped').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  earliestAt: timestamp('earliest_at', { withTimezone: true }),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})
