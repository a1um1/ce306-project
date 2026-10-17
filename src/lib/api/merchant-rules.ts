import { eq, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { merchantRule } from '@/db/schema'
import { merchantCore, type MerchantRule } from '@/lib/utils/categorize'

// Seed rules (user_id IS NULL) first, the user's own rules last, so the user's
// choice overrides a seed for the same merchant.
export async function loadMerchantRules(userId: string): Promise<MerchantRule[]> {
  const rows = await db
    .select({ key: merchantRule.key, categoryId: merchantRule.categoryId })
    .from(merchantRule)
    .where(or(isNull(merchantRule.userId), eq(merchantRule.userId, userId)))
    .orderBy(sql`${merchantRule.userId} asc nulls first`)
  return rows
}

// Remember that this user files this merchant under this category. Called when
// the user sets a category (a manual add, or editing a row) — never on import,
// or the categoriser would learn from its own guesses.
export async function rememberMerchant(
  userId: string,
  title: string,
  categoryId: string | null | undefined,
): Promise<void> {
  if (!categoryId) return
  const key = merchantCore(title)
  if (!key) return
  await db
    .insert(merchantRule)
    .values({ id: crypto.randomUUID(), userId, key, categoryId })
    .onConflictDoUpdate({
      target: [merchantRule.userId, merchantRule.key],
      set: { categoryId, updatedAt: new Date() },
    })
}
