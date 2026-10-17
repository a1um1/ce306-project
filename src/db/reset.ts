import 'dotenv/config'
import { pathToFileURL } from 'node:url'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { seed } from './seed.ts'

// Wipe all data (users, expenses, custom categories, learned rules) and restore
// the built-in categories + seed merchant rules. Schema is left intact: run
// `pnpm db:migrate` first on a fresh database.
export async function reset() {
  const client = postgres(process.env.DATABASE_URL!)
  const db = drizzle(client)
  try {
    await db.execute(
      sql`TRUNCATE TABLE "expense", "merchant_rule", "category", "session", "account", "verification", "user" RESTART IDENTITY CASCADE`,
    )
  } finally {
    await client.end()
  }
  return seed()
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await reset()
  console.log(`reset done: ${result.categories} categories, ${result.rules} merchant rules`)
}
