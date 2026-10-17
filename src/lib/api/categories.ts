import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { category } from '@/db/schema'
import { requireUser } from './session'

export type CategoryInput = { name: string; icon: string; color: string }

export const listCategories = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  return db
    .select()
    .from(category)
    .where(eq(category.userId, user.id))
    .orderBy(asc(category.createdAt))
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
