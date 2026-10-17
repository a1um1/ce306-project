import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/db'
import { category, expense } from '@/db/schema'
import { suggestCategoryId, type CategoryHistory } from '@/lib/utils/categorize'
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
        .where(eq(category.userId, user.id)),
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
