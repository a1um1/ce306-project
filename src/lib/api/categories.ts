import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { category } from '@/db/schema'
import { suggestCategoryId } from '@/lib/utils/categorize'
import { loadMerchantRules } from './merchant-rules'
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

// Auto-categoriser: exact merchant memory. A slip is labelled only when its
// merchant was seen before (a seed brand, or a merchant the user categorised).
// Unknown merchants stay uncategorised — guessing is what filled "อาหาร" with
// 94% of the imported slips.
export const suggestCategories = createServerFn({ method: 'POST' })
  .validator((data: { texts: string[] }) => data)
  .handler(async ({ data }) => {
    const user = await requireUser()
    const rules = await loadMerchantRules(user.id)
    return data.texts.map((text) => suggestCategoryId(text, rules))
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
