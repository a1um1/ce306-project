import { and, desc, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '@/db'
import { category, expense } from '@/db/schema'
import type { ExpenseFilter, ExpenseInput, ExpenseUpdate } from '@/lib/api/types'
import { requireUser } from '../auth-context'
import { applyMerchantCategory, rememberMerchant } from '../merchant-rules'

export const expenseRoutes = new Hono()

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

expenseRoutes.get('/', async (c) => {
  const user = await requireUser(c)
  const filter: ExpenseFilter = {
    from: c.req.query('from'),
    to: c.req.query('to'),
    categoryId: c.req.query('categoryId'),
  }
  const conds = [eq(expense.userId, user.id)]
  if (filter.from) conds.push(gte(expense.occurredAt, new Date(filter.from)))
  if (filter.to) conds.push(lte(expense.occurredAt, new Date(filter.to)))
  // '__none__' is the "uncategorized" sentinel used by the transactions filter.
  if (filter.categoryId === '__none__') conds.push(isNull(expense.categoryId))
  else if (filter.categoryId) conds.push(eq(expense.categoryId, filter.categoryId))
  const rows = await db
    .select(expenseView)
    .from(expense)
    .leftJoin(category, eq(expense.categoryId, category.id))
    .where(and(...conds))
    .orderBy(desc(expense.occurredAt))
  return c.json(rows)
})

expenseRoutes.get('/external-ids', async (c) => {
  const user = await requireUser(c)
  const rows = await db
    .select({ externalId: expense.externalId })
    .from(expense)
    .where(and(eq(expense.userId, user.id), isNotNull(expense.externalId)))
  return c.json(rows.map((row) => row.externalId).filter((value): value is string => Boolean(value)))
})

expenseRoutes.post('/', async (c) => {
  const user = await requireUser(c)
  const data = await c.req.json<ExpenseInput>()
  const [row] = await db
    .insert(expense)
    .values({ ...toRow(data), userId: user.id })
    .returning()
  await rememberMerchant(user.id, data.title, data.categoryId)
  await applyMerchantCategory(user.id, data.title, data.categoryId, row?.id)
  return c.json(row)
})

expenseRoutes.post('/import', async (c) => {
  const user = await requireUser(c)
  const { items } = await c.req.json<{ items: ExpenseInput[] }>()
  if (items.length === 0) return c.json({ inserted: 0, skipped: 0 })
  const rows = await db
    .insert(expense)
    .values(items.map((item) => ({ ...toRow(item), userId: user.id })))
    // Unique on (user_id, external_id): re-importing a slip is a no-op.
    .onConflictDoNothing({ target: [expense.userId, expense.externalId] })
    .returning({ id: expense.id })
  return c.json({ inserted: rows.length, skipped: items.length - rows.length })
})

expenseRoutes.patch('/:id', async (c) => {
  const user = await requireUser(c)
  const data = await c.req.json<ExpenseUpdate>()
  const id = c.req.param('id')
  const [row] = await db
    .update(expense)
    .set({
      title: data.title,
      payee: data.payee ?? null,
      amount: data.amount.toFixed(2),
      categoryId: data.categoryId ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(expense.id, id), eq(expense.userId, user.id)))
    .returning()
  await rememberMerchant(user.id, data.title, data.categoryId)
  await applyMerchantCategory(user.id, data.title, data.categoryId, id)
  return c.json(row ?? null)
})

expenseRoutes.delete('/:id', async (c) => {
  const user = await requireUser(c)
  await db
    .delete(expense)
    .where(and(eq(expense.id, c.req.param('id')), eq(expense.userId, user.id)))
  return c.json({ ok: true })
})
