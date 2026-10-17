import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, isNotNull, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { category, expense } from '@/db/schema'
import { suggestCategoryId, type CategoryHistory } from '@/lib/utils/categorize'
import { requireUser } from './session'

export type CategoryInput = { name: string; icon: string; color: string }

// Built-in categories live in the DB with a NULL user_id (see migration 0003),
// so every account sees the same base set and cannot edit it.
export const listCategories = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  return db
    .select()
    .from(category)
    .where(or(sql`${category.userId} is null`, eq(category.userId, user.id)))
    .orderBy(sql`${category.userId} asc nulls first`, asc(category.createdAt))
})

// Auto-categoriser: with no model involved it leans on the user's own past
// choices first, then on category names appearing in the slip text.
export const suggestCategories = createServerFn({ method: 'POST' })
  .validator((data: { texts: string[] }) => data)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const [options, rows] = await Promise.all([
      db
        .select({ id: category.id, name: category.name })
        .from(category)
        .where(or(sql`${category.userId} is null`, eq(category.userId, user.id))),
      db
        .select({ title: expense.title, payee: expense.payee, categoryId: expense.categoryId })
        .from(expense)
        .where(and(eq(expense.userId, user.id), isNotNull(expense.categoryId)))
        .orderBy(desc(expense.occurredAt))
        .limit(500),
    ])

    const history: CategoryHistory[] = []
    for (const row of rows) {
      if (!row.categoryId) continue
      if (row.title) history.push({ text: row.title, categoryId: row.categoryId })
      if (row.payee) history.push({ text: row.payee, categoryId: row.categoryId })
    }

    return data.texts.map((text) => suggestCategoryId(text, options, history))
  })

export const createCategory = createServerFn({ method: 'POST' })
  .validator((data: CategoryInput) => data)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const [row] = await db
      .insert(category)
      .values({ id: crypto.randomUUID(), userId: user.id, ...data })
      .returning()
    return row
  })

export const updateCategory = createServerFn({ method: 'POST' })
  .validator((data: CategoryInput & { id: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const [row] = await db
      .update(category)
      .set({ name: data.name, icon: data.icon, color: data.color, updatedAt: new Date() })
      .where(and(eq(category.id, data.id), eq(category.userId, user.id)))
      .returning()
    return row
  })
