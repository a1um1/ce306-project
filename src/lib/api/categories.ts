import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { category } from '@/db/schema'
import { CATEGORY_COLORS } from '@/lib/utils/palette'
import { requireUser } from './session'

export type CategoryInput = { name: string; icon: string; color: string }

const STARTER_CATEGORIES = [
  { name: 'อาหาร', icon: 'food' },
  { name: 'เดินทาง', icon: 'transport' },
  { name: 'ช้อปปิ้ง', icon: 'shopping' },
  { name: 'ค่าเล่าเรียน', icon: 'school' },
  { name: 'อื่น ๆ', icon: 'other' },
]

// shortcut: seeds only when the user has no categories at all, so clearing them
// brings the starters back on the next page load. A concurrent first load could
// seed twice; harmless for a single-user account.
async function seedStarterCategories(userId: string) {
  return db
    .insert(category)
    .values(
      STARTER_CATEGORIES.map((starter, index) => ({
        id: crypto.randomUUID(),
        userId,
        name: starter.name,
        icon: starter.icon,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      })),
    )
    .returning()
}

export const listCategories = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  const rows = await db
    .select()
    .from(category)
    .where(eq(category.userId, user.id))
    .orderBy(asc(category.createdAt))
  if (rows.length > 0) return rows
  return seedStarterCategories(user.id)
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
