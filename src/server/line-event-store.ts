import { and, asc, count, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { category, expense, lineEvent, lineLink, lineLinkCode } from '@/db/schema'
import type { ParsedItem } from '@/lib/utils/memo-parser'

// Every DB touch the LINE handler needs, behind one interface so tests can run
// it against memory. Production code uses dbLineStore.
export interface InsertableExpense {
  title: string
  amount: number
  type: 'expense' | 'income'
  note: string | null
  categoryId: string | null
  occurredAt: Date
}

export interface LineStore {
  beginEvent(eventId: string, type: string, payload: unknown): Promise<'inserted' | 'duplicate'>
  finishEvent(eventId: string, ok: boolean, error?: string): Promise<void>

  findLink(lineUserId: string): Promise<{ userId: string } | null>
  findCode(code: string, now: Date): Promise<{ code: string; userId: string } | null>
  createLink(userId: string, lineUserId: string, now: Date): Promise<void>
  markCodeUsed(code: string, now: Date): Promise<void>

  categories(userId: string): Promise<{ id: string; name: string }[]>
  insertExpenses(
    userId: string,
    items: InsertableExpense[],
    rawText: string,
  ): Promise<{ id: string; title: string; amount: string }[]>
  latestLineExpense(userId: string): Promise<{ id: string; title: string; amount: string } | null>
  softDeleteExpense(id: string, userId: string): Promise<boolean>
  getExpense(id: string, userId: string): Promise<{ id: string; title: string; amount: string } | null>
  setExpenseCategory(id: string, userId: string, categoryId: string): Promise<boolean>
  replaceExpense(id: string, userId: string, item: InsertableExpense, rawText: string): Promise<boolean>
  summary(userId: string, scope: 'today' | 'month'): Promise<{
    total: number
    income: number
    count: number
    top: { name: string; sum: number }[]
  }>
}

// ---------------------------------------------------------------------------
// Drizzle-backed implementation
// ---------------------------------------------------------------------------

const expenseView = {
  id: expense.id,
  title: expense.title,
  amount: expense.amount,
}

async function findCodeSql(code: string, now: Date): Promise<{ code: string; userId: string } | null> {
  const [row] = await db
    .select({ code: lineLinkCode.code, userId: lineLinkCode.userId })
    .from(lineLinkCode)
    .where(
      and(
        eq(lineLinkCode.code, code.toUpperCase()),
        gte(lineLinkCode.expiresAt, now),
        isNull(lineLinkCode.usedAt),
      ),
    )
    .limit(1)
  return row ?? null
}

export const dbLineStore: LineStore = {
  async beginEvent(eventId, type, payload) {
    const [row] = await db
      .insert(lineEvent)
      .values({ id: crypto.randomUUID(), webhookEventId: eventId, type, payload })
      .onConflictDoNothing({ target: [lineEvent.webhookEventId] })
      .returning({ id: lineEvent.id })
    return row ? 'inserted' : 'duplicate'
  },
  async finishEvent(eventId, ok, error) {
    await db
      .update(lineEvent)
      .set({ status: ok ? 'processed' : 'failed', error: ok ? null : (error ?? null) })
      .where(eq(lineEvent.webhookEventId, eventId))
  },
  async findLink(lineUserId) {
    const [row] = await db
      .select({ userId: lineLink.userId })
      .from(lineLink)
      .where(eq(lineLink.lineUserId, lineUserId))
      .limit(1)
    return row ?? null
  },
  async findCode(code, now) {
    return findCodeSql(code, now)
  },
  async createLink(userId, lineUserId, now) {
    await db
      .insert(lineLink)
      .values({ id: crypto.randomUUID(), userId, lineUserId, linkedAt: now })
      .onConflictDoNothing({ target: [lineLink.lineUserId] })
  },
  async markCodeUsed(code, now) {
    await db
      .update(lineLinkCode)
      .set({ usedAt: now })
      .where(eq(lineLinkCode.code, code.toUpperCase()))
  },
  async categories(userId) {
    return db
      .select({ id: category.id, name: category.name })
      .from(category)
      .where(sql`${category.userId} is null or ${category.userId} = ${userId}`)
      .orderBy(sql`${category.userId} asc nulls first`, asc(category.createdAt))
  },
  async insertExpenses(userId, items, rawText) {
    const rows = await db.transaction(async (tx) =>
      tx
        .insert(expense)
        .values(
          items.map((item) => ({
            id: crypto.randomUUID(),
            userId,
            title: item.title,
            payee: null,
            amount: item.amount.toFixed(2),
            type: item.type,
            note: item.note,
            categoryId: item.categoryId,
            occurredAt: item.occurredAt,
            source: 'line_text',
            rawText,
          })),
        )
        .returning(expenseView),
    )
    return rows
  },
  async latestLineExpense(userId) {
    const [row] = await db
      .select(expenseView)
      .from(expense)
      .where(and(eq(expense.userId, userId), eq(expense.source, 'line_text'), isNull(expense.deletedAt)))
      .orderBy(desc(expense.createdAt))
      .limit(1)
    return row ?? null
  },
  async softDeleteExpense(id, userId) {
    const [row] = await db
      .update(expense)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(expense.id, id), eq(expense.userId, userId)))
      .returning({ id: expense.id })
    return Boolean(row)
  },
  async getExpense(id, userId) {
    const [row] = await db
      .select(expenseView)
      .from(expense)
      .where(and(eq(expense.id, id), eq(expense.userId, userId)))
      .limit(1)
    return row ?? null
  },
  async setExpenseCategory(id, userId, categoryId) {
    const [row] = await db
      .update(expense)
      .set({ categoryId, updatedAt: new Date() })
      .where(and(eq(expense.id, id), eq(expense.userId, userId)))
      .returning({ id: expense.id })
    return Boolean(row)
  },
  async replaceExpense(id, userId, item, rawText) {
    const [row] = await db
      .update(expense)
      .set({
        title: item.title,
        amount: item.amount.toFixed(2),
        type: item.type,
        note: item.note,
        categoryId: item.categoryId,
        occurredAt: item.occurredAt,
        rawText,
        updatedAt: new Date(),
      })
      .where(and(eq(expense.id, id), eq(expense.userId, userId)))
      .returning({ id: expense.id })
    return Boolean(row)
  },
  async summary(userId, scope) {
    const now = new Date()
    const from =
      scope === 'today'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth(), 1)
    const aggregate = await db
      .select({
        spent: sql<string>`coalesce(sum(case when ${expense.type} = 'expense' then ${expense.amount} else 0 end), 0)`,
        income: sql<string>`coalesce(sum(case when ${expense.type} = 'income' then ${expense.amount} else 0 end), 0)`,
        count: count(expense.id),
      })
      .from(expense)
      .where(
        and(eq(expense.userId, userId), gte(expense.occurredAt, from), isNull(expense.deletedAt)),
      )
    const top = await db
      .select({ name: category.name, sum: sql<string>`sum(${expense.amount})` })
      .from(expense)
      .leftJoin(category, eq(expense.categoryId, category.id))
      .where(
        and(
          eq(expense.userId, userId),
          eq(expense.type, 'expense'),
          gte(expense.occurredAt, from),
          isNull(expense.deletedAt),
        ),
      )
      .groupBy(category.name)
      .orderBy(desc(sql`sum(${expense.amount})`))
      .limit(3)
    const a = aggregate[0] ?? { spent: '0', income: '0', count: 0 }
    return {
      total: Number(a.spent),
      income: Number(a.income),
      count: Number(a.count),
      top: top.filter((t) => t.name).map((t) => ({ name: t.name!, sum: Number(t.sum) })),
    }
  },
}

// ---------------------------------------------------------------------------
// Web-side link code helpers (not part of LineStore: only used by the settings
// endpoints, never by the webhook handler)
// ---------------------------------------------------------------------------

// Drop the user's older unused codes and issue a fresh one.
export async function replaceLinkCode(userId: string, code: string, expiresAt: Date): Promise<void> {
  await db.delete(lineLinkCode).where(and(eq(lineLinkCode.userId, userId), isNull(lineLinkCode.usedAt)))
  await db.insert(lineLinkCode).values({ code, userId, expiresAt })
}

export async function countLinkCodesInHour(userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(lineLinkCode)
    .where(and(eq(lineLinkCode.userId, userId), gte(lineLinkCode.createdAt, since)))
  return Number(row?.count ?? 0)
}

export async function latestUnusedCode(
  userId: string,
  now: Date,
): Promise<{ code: string; expiresAt: Date } | null> {
  const [row] = await db
    .select({ code: lineLinkCode.code, expiresAt: lineLinkCode.expiresAt })
    .from(lineLinkCode)
    .where(and(eq(lineLinkCode.userId, userId), gte(lineLinkCode.expiresAt, now), isNull(lineLinkCode.usedAt)))
    .orderBy(desc(lineLinkCode.createdAt))
    .limit(1)
  return row ? { code: row.code, expiresAt: row.expiresAt } : null
}

export async function isUserLinked(userId: string): Promise<boolean> {
  const [row] = await db.select({ userId: lineLink.userId }).from(lineLink).where(eq(lineLink.userId, userId)).limit(1)
  return Boolean(row)
}

export async function unlinkUser(userId: string): Promise<void> {
  await db.delete(lineLink).where(eq(lineLink.userId, userId))
}
