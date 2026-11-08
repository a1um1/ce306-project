// LINE natural-language handler: text message -> Apple Foundation Model (via the
// line-nlu Swift service) -> add_expense / query_expenses / delete_last -> reply.
// The model picks tools; the app validates arguments and computes all sums.
import { and, count, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { category, expense } from '@/db/schema'
import { formatAmount } from '@/lib/utils/format'
import { replyMessage, type Client } from './line-client'

export type LineEvent = {
  id: string
  type: string
  replyToken?: string
  source?: { userId?: string }
  message?: { id: string; type: string; text?: string }
  [key: string]: unknown
}

// One model step: either a tool call or a final Thai reply.
export type Step = { tool: string; args: string; reply: string }

export type LineDeps = {
  client?: Pick<Client, 'replyMessage'>
  callModel?: (date: string, history: string) => Promise<Step>
  runTool?: (tool: string, argsJson: string, userId: string, now: Date) => Promise<string>
  userIdFor?: (lineUserId: string) => string | null
  now?: () => Date
}

// Line message params the model may pass. Strictly validated before use.
type AddItem = { amount: number; note: string; category?: string | null; date?: string | null; type?: 'expense' | 'income' }
type AddArgs = { items: AddItem[] }
type QueryArgs = { date_from?: string | null; date_to?: string | null; category?: string | null; keyword?: string | null }

const MAX_TOOL_CALLS = 3
const TIMEZONE = () => process.env.APP_TIMEZONE ?? 'Asia/Bangkok'
const NOT_LINKED_TEXT =
  'ยังไม่ได้เชื่อมต่อบัญชี LINE กับ PayTail ในระบบนี้ครับ จับคู่ผ่าน LINE_LOGIN/ENV ตามที่ตั้งไว้'

// ---------------------------------------------------------------------------
// User resolution: env mapping for now (LINE_USER_ID -> PAYTAIL_USER_ID).
// Linking through better-auth LINE OAuth is the planned replacement.
// ---------------------------------------------------------------------------

function envUserId(lineUserId: string): string | null {
  if (process.env.LINE_USER_ID === lineUserId) return process.env.PAYTAIL_USER_ID ?? null
  return null
}

// Wall-clock YYYY-MM-DD in Bangkok (the assistant's calendar).
function todayInTz(timezone: string, at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

function tzOffsetMinutes(timezone: string, at: Date): number {
  const off = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value ?? ''
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(off)
  if (!m) return 0
  const minutes = m[3] ? Number(m[3]) : 0
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + minutes)
}

// 'YYYY-MM-DD' -> 12:00 noon at that date in timezone, as a UTC instant.
function noonInTz(date: string, timezone: string, at: Date): Date {
  const [y, m, d] = date.split('-').map(Number)
  if (![y, m, d].every(Number.isFinite)) return at
  return new Date(Date.UTC(y, m - 1, d, 12) - tzOffsetMinutes(timezone, at) * 60_000)
}

// ---------------------------------------------------------------------------
// The three tools. All DB access, sums and validation live here — the model
// never returns a computed total.
// ---------------------------------------------------------------------------

async function resolveCategoryId(userId: string, name: string): Promise<string | null> {
  const [row] = await db
    .select({ id: category.id })
    .from(category)
    .where(
      and(
        or(eq(category.userId, userId), isNull(category.userId)),
        ilike(category.name, `%${name.trim()}%`),
      ),
    )
    .limit(1)
  return row?.id ?? null
}

async function addExpense(argsRaw: unknown, userId: string, now: Date): Promise<string> {
  const args = argsRaw as AddArgs
  if (!Array.isArray(args.items) || args.items.length === 0) return 'ERROR: items array required'
  const tz = TIMEZONE()
  const rows = []
  for (const item of args.items) {
    if (!item || typeof item.amount !== 'number' || !Number.isFinite(item.amount) || item.amount <= 0) {
      return 'ERROR: each item needs a positive number amount'
    }
    if (item.amount > 10_000_000) return 'ERROR: amount too large'
    const note = String(item.note ?? '').trim()
    if (!note) return 'ERROR: each item needs a note'
    const date = item.date && /^\d{4}-\d{2}-\d{2}$/.test(String(item.date)) ? String(item.date) : null
    rows.push({
      id: crypto.randomUUID(),
      userId,
      title: note,
      payee: null,
      amount: item.amount.toFixed(2),
      type: item.type === 'income' ? 'income' : 'expense',
      note,
      categoryId: item.category ? await resolveCategoryId(userId, String(item.category)) : null,
      occurredAt: date ? noonInTz(date, tz, now) : now,
      source: 'line_text',
      rawText: null,
    })
  }
  const saved = await db.insert(expense).values(rows).returning({ id: expense.id, title: expense.title, amount: expense.amount })
  const lines = saved.map((r) => `${r.title} ${formatAmount(r.amount)}`).join(', ')
  return `OK: saved ${lines}`
}

type QueryRow = { title: string; amount: string; occurredAt: Date | null }

async function queryExpenses(argsRaw: unknown, userId: string, now: Date): Promise<string> {
  const args = (argsRaw ?? {}) as QueryArgs
  const tz = TIMEZONE()
  const filters = [eq(expense.userId, userId), isNull(expense.deletedAt)]
  if (args.date_from) filters.push(gte(expense.occurredAt, noonInTz(String(args.date_from), tz, now)))
  if (args.date_to) filters.push(lte(expense.occurredAt, noonInTz(String(args.date_to), tz, now)))
  if (args.category) {
    const ids = await db
      .select({ id: category.id })
      .from(category)
      .where(and(or(eq(category.userId, userId), isNull(category.userId)), ilike(category.name, `%${String(args.category).trim()}%`)))
    if (ids.length === 0) return 'NO DATA: no such category'
    filters.push(eq(expense.categoryId, ids[0].id))
  }
  if (args.keyword) {
    const kw = `%${String(args.keyword).trim()}%`
    filters.push(ilike(expense.title, kw))
  }

  const [agg] = await db
    .select({
      total: sql`coalesce(sum(case when ${expense.type} = 'expense' then ${expense.amount} else 0 end), 0)`,
      income: sql`coalesce(sum(case when ${expense.type} = 'income' then ${expense.amount} else 0 end), 0)`,
      count: count(expense.id),
    })
    .from(expense)
    .where(and(...filters))

  const rows = (await db
    .select({ title: expense.title, amount: expense.amount, occurredAt: expense.occurredAt })
    .from(expense)
    .where(and(...filters))
    .orderBy(desc(expense.occurredAt))
    .limit(5)) as QueryRow[]

  const parts = [`spent ${formatAmount(Number(agg.total))}`, `${agg.count} entries`]
  if (Number(agg.income) > 0) parts.push(`income ${formatAmount(Number(agg.income))}`)
  const top = rows
    .map((r) => `${r.title} ${formatAmount(r.amount)}`)
  if (top.length > 0) parts.push('top: ' + top.join(', '))
  return parts.join('; ')
}

async function deleteLast(userId: string, now: Date): Promise<string> {
  const [latest] = await db
    .select({ id: expense.id, title: expense.title, amount: expense.amount, createdAt: expense.createdAt })
    .from(expense)
    .where(and(eq(expense.userId, userId), isNull(expense.deletedAt)))
    .orderBy(desc(expense.createdAt))
    .limit(1)
  if (!latest) return 'NO DATA: nothing to delete'
  await db
    .update(expense)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(expense.id, latest.id))
  return `OK: deleted ${latest.title} ${formatAmount(latest.amount)}`
}

async function runTool(tool: string, argsJson: string, userId: string, now: Date): Promise<string> {
  let args: unknown = {}
  if (argsJson) {
    try {
      args = JSON.parse(argsJson)
    } catch {
      return 'ERROR: arguments are not valid JSON'
    }
  }
  switch (tool) {
    case 'add_expense':
      return addExpense(args, userId, now)
    case 'query_expenses':
      return queryExpenses(args, userId, now)
    case 'delete_last':
      return deleteLast(userId, now)
    default:
      return `ERROR: unknown tool ${tool}`
  }
}

// ---------------------------------------------------------------------------
// Apple Foundation Model client -> the local line-nlu Swift service.
// ---------------------------------------------------------------------------

async function callModel(date: string, history: string): Promise<Step> {
  const base = process.env.LINE_NLU_URL ?? 'http://127.0.0.1:4002'
  const res = await fetch(`${base}/respond`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ date, history }),
  })
  if (!res.ok) throw new Error(`line-nlu service returned ${res.status}`)
  return (await res.json()) as Step
}

// ---------------------------------------------------------------------------
// Orchestration: ack reply, then up to MAX_TOOL_CALLS tool turns, then a final
// Thai reply. Every message, tool call and result is logged.
// ---------------------------------------------------------------------------

export async function processLineEvent(event: LineEvent, deps: LineDeps = {}): Promise<void> {
  const {
    client = { replyMessage },
    callModel: call = callModel,
    runTool: run = runTool,
    userIdFor = envUserId,
    now = () => new Date(),
  } = deps
  const replyToken = event.replyToken ?? ''
  const lineUserId = event.source?.userId ?? ''

  try {
    if (event.type !== 'message' || event.message?.type !== 'text' || !replyToken) return
    const text = event.message.text ?? ''
    console.log(`[line] message from ${lineUserId}: ${text}`)

    const userId = userIdFor(lineUserId)
    if (!userId) {
      await client.replyMessage(replyToken, [{ type: 'text', text: NOT_LINKED_TEXT }])
      return
    }

    const tz = TIMEZONE()
    const date = todayInTz(tz, now())
    let history = `user: ${text}`
    let final = 'เสร็จแล้วครับ'

    for (let turn = 0; turn <= MAX_TOOL_CALLS; turn++) {
      const step = await call(date, history)
      if (!step.tool || turn === MAX_TOOL_CALLS) {
        final = step.reply || final
        break
      }
      const result = await run(step.tool, step.args, userId, now())
      console.log(`[line] tool ${step.tool}: ${step.args} -> ${result}`)
      history += `\nassistant: tool ${step.tool}(${step.args})\nresult: ${result}`
    }

    console.log(`[line] reply: ${final}`)
    await client.replyMessage(replyToken, [{ type: 'text', text: final }])
  } catch (error) {
    console.error('[line] failed:', error instanceof Error ? error.message : error)
    await client.replyMessage(replyToken, [{ type: 'text', text: 'จดไม่สำเร็จ ลองใหม่นะ' }])
  }
}
