import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/db'
import { category, expense } from '@/db/schema'
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

export const createExpense = createServerFn({ method: 'POST' })
  .validator((data: ExpenseInput) => data)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const [row] = await db
      .insert(expense)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        title: data.title,
        payee: data.payee ?? null,
        amount: data.amount.toFixed(2),
        occurredAt: new Date(data.occurredAt),
        categoryId: data.categoryId ?? null,
        source: data.source ?? 'manual',
        qrPayload: data.qrPayload ?? null,
      })
      .returning()
    return row
  })
