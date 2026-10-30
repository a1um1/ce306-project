import { and, asc, count, eq, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '@/db'
import { category, expense } from '@/db/schema'
import type { CategoryInput } from '@/lib/api/types'
import { suggestCategoryId } from '@/lib/utils/categorize'
import { requireUser } from '../auth-context'
import { loadMerchantRules } from '../merchant-rules'

export const categoryRoutes = new Hono()

// Built-in categories live in the DB with a NULL user_id (see migration 0003),
// so every account sees the same base set and cannot edit it.
categoryRoutes.get('/', async (c) => {
  const user = await requireUser(c)
  const rows = await db
    .select({
      id: category.id,
      userId: category.userId,
      name: category.name,
      icon: category.icon,
      color: category.color,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      // The picker puts the most-used categories first within the built-ins.
      usage: count(expense.id),
    })
    .from(category)
    .leftJoin(expense, and(eq(expense.categoryId, category.id), eq(expense.userId, user.id)))
    .where(or(sql`${category.userId} is null`, eq(category.userId, user.id)))
    .groupBy(category.id)
    .orderBy(sql`${category.userId} asc nulls first`, asc(category.createdAt))
  return c.json(rows)
})

// Auto-categoriser: exact merchant memory. A slip is labelled only when its
// merchant was seen before (a seed brand, or a merchant the user categorised).
// Unknown merchants stay uncategorised — guessing is what filled "อาหาร" with
// 94% of the imported slips.
categoryRoutes.post('/suggest', async (c) => {
  const user = await requireUser(c)
  const { texts } = await c.req.json<{ texts: string[] }>()
  const rules = await loadMerchantRules(user.id)
  return c.json(texts.map((text) => suggestCategoryId(text, rules)))
})

categoryRoutes.post('/', async (c) => {
  const user = await requireUser(c)
  const data = await c.req.json<CategoryInput>()
  const [row] = await db
    .insert(category)
    .values({ id: crypto.randomUUID(), userId: user.id, ...data })
    .returning()
  return c.json(row)
})

categoryRoutes.patch('/:id', async (c) => {
  const user = await requireUser(c)
  const data = await c.req.json<CategoryInput>()
  const [row] = await db
    .update(category)
    .set({ name: data.name, icon: data.icon, color: data.color, updatedAt: new Date() })
    .where(and(eq(category.id, c.req.param('id')), eq(category.userId, user.id)))
    .returning()
  return c.json(row)
})
