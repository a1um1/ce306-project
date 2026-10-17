import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gte, isNotNull, lte } from 'drizzle-orm'
import { db } from '@/db'
import { category, expense } from '@/db/schema'
import { rememberMerchant } from './merchant-rules'
import { requireUser } from './session'

export type ExpenseFilter = { from?: string; to?: string; categoryId?: string }
export type ExpenseInput = {
  title: string
  payee?: string | null
  amount: number
  occurredAt: string
  categoryId?: string | null
  source?: 'manual' | 'qr'
  qrPayload?: string | null
  externalId?: string | null
}

export type ExpenseRow = {
  id: string
  title: string
  payee: string | null
  amount: string
  occurredAt: Date
  source: string
  categoryId: string | null
  categoryName: string | null
  categoryIcon: string | null
  categoryColor: string | null
}

const expenseView = {
  id: expense.id,
  title: expense.title,
  payee: expense.payee,
  amount: expense.amount,
  occurredAt: expense.occurredAt,
  source: expense.source,
  categoryId: expense.categoryId,
  categoryName: category.name,
  categoryIcon: category.icon,
  categoryColor: category.color,
}

function toRow(item: ExpenseInput) {
  return {
    id: crypto.randomUUID(),
    title: item.title,
    payee: item.payee ?? null,
    amount: item.amount.toFixed(2),
    occurredAt: new Date(item.occurredAt),
    categoryId: item.categoryId ?? null,
    source: item.source ?? 'manual',
    qrPayload: item.qrPayload ?? null,
    externalId: item.externalId ?? null,
  }
}

export const listExpenses = createServerFn({ method: 'POST' })
  .validator((data: ExpenseFilter) => data)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const conds = [eq(expense.userId, user.id)]
    if (data.from) conds.push(gte(expense.occurredAt, new Date(data.from)))
    if (data.to) conds.push(lte(expense.occurredAt, new Date(data.to)))
    if (data.categoryId) conds.push(eq(expense.categoryId, data.categoryId))
    return db
      .select(expenseView)
      .from(expense)
      .leftJoin(category, eq(expense.categoryId, category.id))
      .where(and(...conds))
      .orderBy(desc(expense.occurredAt))
  })

export const listImportedExternalIds = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  const rows = await db
    .select({ externalId: expense.externalId })
    .from(expense)
    .where(and(eq(expense.userId, user.id), isNotNull(expense.externalId)))
  return rows.map((row) => row.externalId).filter((value): value is string => Boolean(value))
})

export const createExpense = createServerFn({ method: 'POST' })
  .validator((data: ExpenseInput) => data)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const [row] = await db
      .insert(expense)
      .values({ ...toRow(data), userId: user.id })
      .returning()
    await rememberMerchant(user.id, data.title, data.categoryId)
    return row
  })

export const importExpenses = createServerFn({ method: 'POST' })
  .validator((data: { items: ExpenseInput[] }) => data)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (data.items.length === 0) return { inserted: 0, skipped: 0 }
    const rows = await db
      .insert(expense)
      .values(data.items.map((item) => ({ ...toRow(item), userId: user.id })))
      // Unique on (user_id, external_id): re-importing a slip is a no-op.
      .onConflictDoNothing({ target: [expense.userId, expense.externalId] })
      .returning({ id: expense.id })
    return { inserted: rows.length, skipped: data.items.length - rows.length }
  })

export type ExpenseUpdate = {
  id: string
  title: string
  payee?: string | null
  amount: number
  categoryId?: string | null
}

export const updateExpense = createServerFn({ method: 'POST' })
  .validator((data: ExpenseUpdate) => data)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const [row] = await db
      .update(expense)
      .set({
        title: data.title,
        payee: data.payee ?? null,
        amount: data.amount.toFixed(2),
        categoryId: data.categoryId ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(expense.id, data.id), eq(expense.userId, user.id)))
      .returning()
    await rememberMerchant(user.id, data.title, data.categoryId)
    return row ?? null
  })

export const deleteExpense = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireUser()
    await db.delete(expense).where(and(eq(expense.id, data.id), eq(expense.userId, user.id)))
    return { ok: true }
  })
