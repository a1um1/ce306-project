// LINE natural-language handler: text message -> Apple Foundation Model (via the
// line-nlu Swift service) -> tools -> reply.
// Single-item add saves immediately; a multi-item memo shows a flex confirm
// card and only saves when the user taps "บันทึก" (postback).
import { and, count, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { account, category, expense } from '@/db/schema'
import { formatAmount } from '@/lib/utils/format'
import { pushMessage, replyMessage, type Client } from './line-client'

export type LineEvent = {
  id: string
  type: string
  replyToken?: string
  source?: { userId?: string }
  message?: { id: string; type: string; text?: string }
  postback?: { data?: string }
  [key: string]: unknown
}

// One model step: either a tool call or a final Thai reply.
export type Step = { tool: string; args: string; reply: string }

// One validated expense row, ready to insert (as built by buildRows).
export type ExpenseRow = {
  id: string
  userId: string
  title: string
  payee: null
  amount: string
  type: 'expense' | 'income'
  note: string
  categoryId: string | null
  occurredAt: Date
  source: 'line_text'
  rawText: null
}

export type LineDeps = {
  client?: Pick<Client, 'replyMessage' | 'pushMessage'>
  callModel?: (date: string, history: string) => Promise<Step>
  runTool?: (tool: string, argsJson: string, userId: string, now: Date) => Promise<string>
  userIdFor?: (lineUserId: string) => string | null | Promise<string | null>
  now?: () => Date
  insertRows?: (rows: ExpenseRow[]) => Promise<Array<{ title: string; amount: string }>>
  memoStore?: Map<string, PendingMemo>
}

// One memo awaiting the user's tap on its confirm card. id travels in the card's
// postback data, so acting on a card touches only that card's pending memo —
// older cards (a newer memo overwrote it) become no-ops instead of saving the
// wrong rows.
export type PendingMemo = { id: string; rows: ExpenseRow[] }

// Line message params the model may pass. Strictly validated before use.
type AddItem = { amount: number; note: string; category?: string | null; date?: string | null; type?: 'expense' | 'income' }
type AddArgs = { items: AddItem[] }
type QueryArgs = { date_from?: string | null; date_to?: string | null; category?: string | null; keyword?: string | null }

const MAX_TOOL_CALLS = 3
const TIMEZONE = () => process.env.APP_TIMEZONE ?? 'Asia/Bangkok'
const NOT_LINKED_TEXT =
  'ยังไม่พบการเชื่อมต่อบัญชี LINE กับ PayTail ครับ เข้าแอป > การตั้งค่า > เชื่อมต่อ LINE ก่อนเริ่มจดรายจ่ายได้เลย'
const BRAND = '#fbb046' // website --primary

const defaultClient: Pick<Client, 'replyMessage' | 'pushMessage'> = { replyMessage, pushMessage }

// Memos awaiting the user's "บันทึก" tap: lineUserId -> pending. Saved (or
// dropped) on the postback, so nothing is written until the user confirms.
// shortcut: in-memory, lost on restart; upgrade to a table if the box restarts often
export const pendingMemos = new Map<string, PendingMemo>()

// One branded flex card for any bot message: orange header, white text.
function textFlex(text: string): unknown {
  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: BRAND,
      contents: [{ type: 'text', text, color: '#ffffff', weight: 'bold', size: 'md', wrap: true, align: 'center' }],
    },
  }
}

// ---------------------------------------------------------------------------
// User resolution. A user who linked LINE via OAuth (settings page:
// `account` with providerId='line'; accountId is the LINE user id, same id the
// Messaging API webhook reports when the LINE Login + Messaging API channels
// share the same provider). The env pair is the fallback for that single-user
// deployment.
// ---------------------------------------------------------------------------

async function resolveUserId(lineUserId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: account.userId })
    .from(account)
    .where(and(eq(account.providerId, 'line'), eq(account.accountId, lineUserId)))
    .limit(1)
  if (row) return row.userId
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

// Validate the model's add_expense args and build ready-to-insert rows. Category
// ids and dates are resolved here, so the confirm postback can insert instantly.
async function buildRows(argsRaw: unknown, userId: string, now: Date): Promise<{ ok: true; rows: ExpenseRow[] } | { ok: false; error: string }> {
  const args = argsRaw as AddArgs
  if (!Array.isArray(args.items) || args.items.length === 0) return { ok: false, error: 'ERROR: items array required' }
  const tz = TIMEZONE()
  const rows: ExpenseRow[] = []
  for (const item of args.items) {
    if (!item || typeof item.amount !== 'number' || !Number.isFinite(item.amount) || item.amount <= 0) {
      return { ok: false, error: 'ERROR: each item needs a positive number amount' }
    }
    if (item.amount > 10_000_000) return { ok: false, error: 'ERROR: amount too large' }
    const note = String(item.note ?? '').trim()
    if (!note) return { ok: false, error: 'ERROR: each item needs a note' }
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
  return { ok: true, rows }
}

async function insertRows(rows: ExpenseRow[]): Promise<Array<{ title: string; amount: string }>> {
  return db
    .insert(expense)
    .values(rows)
    .returning({ title: expense.title, amount: expense.amount })
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
    case 'add_expense': {
      const built = await buildRows(args, userId, now)
      if (!built.ok) return built.error
      const saved = await insertRows(built.rows)
      return `OK: saved ${saved.map((r) => `${r.title} ${formatAmount(r.amount)}`).join(', ')}`
    }
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
// Flex confirm card for a multi-item memo.
// ---------------------------------------------------------------------------

function memoConfirmFlex(rows: ExpenseRow[], id: string): unknown {
  const total = rows.reduce((sum, r) => sum + Number(r.amount), 0)
  const items = rows.map((r) => ({
    type: 'box',
    layout: 'baseline',
    spacing: 'sm',
    contents: [
      { type: 'text', text: r.title, flex: 2, size: 'sm', wrap: true },
      { type: 'text', text: formatAmount(r.amount), flex: 1, size: 'sm', align: 'end' },
    ],
  }))
  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: BRAND,
      contents: [{ type: 'text', text: 'จดรายจ่ายนี้ใช่ไหม?', color: '#ffffff', weight: 'bold', size: 'md', align: 'center' }],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        ...items,
        { type: 'separator' },
        {
          type: 'box',
          layout: 'baseline',
          contents: [
            { type: 'text', text: 'รวม', weight: 'bold', flex: 2 },
            { type: 'text', text: `${formatAmount(total)} บาท`, weight: 'bold', color: BRAND, flex: 1, align: 'end' },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'button', style: 'primary', height: 'sm', color: BRAND, action: { type: 'postback', label: 'บันทึก', data: `memo:save:${id}`, displayText: 'บันทึกเลย' } },
        { type: 'button', style: 'link', height: 'sm', color: BRAND, action: { type: 'postback', label: 'แก้ไข', data: `memo:edit:${id}`, displayText: 'ขอแก้ไข' } },
        { type: 'button', style: 'secondary', height: 'sm', color: '#999999', action: { type: 'postback', label: 'ยกเลิก', data: `memo:cancel:${id}`, displayText: 'ไม่จด' } },
      ],
    },
  }
}

// Immediate processing feedback: the app replies this flex before parsing, so
// the user sees the memo is being read instead of a silent wait for the push.
const processingFlex = () => textFlex('กำลังอ่านเมมโม่…')

// ---------------------------------------------------------------------------
// Postback from a memo confirm card: save (insert the pending rows) or cancel.
// ---------------------------------------------------------------------------

async function processPostback(
  event: LineEvent,
  client: Pick<Client, 'replyMessage' | 'pushMessage'>,
  save: (rows: ExpenseRow[]) => Promise<Array<{ title: string; amount: string }>>,
  memoStore: Map<string, PendingMemo>,
): Promise<void> {
  const data = event.postback?.data ?? ''
  const lineUserId = event.source?.userId ?? ''
  const replyToken = event.replyToken ?? ''
  const match = /^memo:(save|cancel|edit):([\w-]+)$/.exec(data)
  if (!match) return
  const [, action, id] = match
  const pending = memoStore.get(lineUserId)
  // Acting on a card removes its pending memo; an old card (a newer memo or a
  // restart wiped the store) is a clean no-op, never a wrong save.
  if (!pending || pending.id !== id) {
    if (replyToken) await client.replyMessage(replyToken, [{ type: 'flex', altText: 'การ์ดเก่าแล้ว', contents: textFlex('การ์ดใบนี้เก่าแล้ว ส่งเมมโมใหม่ได้เลยครับ') }])
    return
  }
  memoStore.delete(lineUserId)
  if (action === 'cancel') {
    if (replyToken) await client.replyMessage(replyToken, [{ type: 'flex', altText: 'ไม่จดแล้วครับ', contents: textFlex('ไม่จดแล้วครับ') }])
    return
  }
  if (action === 'edit') {
    if (replyToken) await client.replyMessage(replyToken, [{ type: 'flex', altText: 'โอเค ส่งเมมโมที่แก้แล้วมาได้เลยครับ', contents: textFlex('โอเค ส่งเมมโมที่แก้แล้วมาได้เลยครับ') }])
    return
  }
  const saved = await save(pending.rows)
  const lines = saved.map((r) => `${r.title} ${formatAmount(r.amount)}`).join(', ')
  const done = `บันทึกแล้วครับ: ${lines}`
  if (replyToken) await client.replyMessage(replyToken, [{ type: 'flex', altText: done, contents: textFlex(done) }])
}

// ---------------------------------------------------------------------------
// Orchestration.
// Message events: ack flex, then parse (<= MAX_TOOL_CALLS tool turns).
// add_expense is terminal: single item auto-saves, multiple items push a
// confirm flex and wait for the postback. Replies are pushed because the
// model runs can outlast the ~10s reply-token window.
// ---------------------------------------------------------------------------

export async function processLineEvent(event: LineEvent, deps: LineDeps = {}): Promise<void> {
  const {
    client = defaultClient,
    callModel: call = callModel,
    runTool: run = runTool,
    userIdFor = resolveUserId,
    now = () => new Date(),
    insertRows: save = insertRows,
    memoStore = pendingMemos,
  } = deps
  const replyToken = event.replyToken ?? ''
  const lineUserId = event.source?.userId ?? ''

  try {
    if (event.type === 'postback') {
      await processPostback(event, client, save, memoStore)
      return
    }
    if (event.type !== 'message' || event.message?.type !== 'text' || !replyToken) return
    const text = event.message.text ?? ''
    console.log(`[line] message from ${lineUserId}: ${text}`)
    await client.replyMessage(replyToken, [{ type: 'flex', altText: 'กำลังอ่านเมมโม่…', contents: processingFlex() }])

  const userId = await userIdFor(lineUserId)
  if (!userId) {
    await client.pushMessage(lineUserId, [{ type: 'flex', altText: NOT_LINKED_TEXT, contents: textFlex(NOT_LINKED_TEXT) }])
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
      if (step.tool === 'add_expense') {
        let argsRaw: unknown = {}
        if (step.args) {
          try {
            argsRaw = JSON.parse(step.args)
          } catch {
            argsRaw = {}
          }
        }
        const built = await buildRows(argsRaw, userId, now())
        if (!built.ok) {
          // Validation failed: feed the error back so the model can retry once.
          history += `\nassistant: tool add_expense(${step.args})\nresult: ${built.error}`
          continue
        }
        if (built.rows.length === 1) {
          const saved = await save(built.rows)
          const text = saved.map((r) => `${r.title} ${formatAmount(r.amount)}`).join(', ')
          await client.pushMessage(lineUserId, [{ type: 'flex', altText: `บันทึกแล้วครับ: ${text}`, contents: textFlex(`บันทึกแล้วครับ: ${text}`) }])
        } else {
          const id = crypto.randomUUID().slice(0, 8)
          memoStore.set(lineUserId, { id, rows: built.rows })
          await client.pushMessage(lineUserId, [{ type: 'flex', altText: 'ยืนยันการจดรายจ่าย', contents: memoConfirmFlex(built.rows, id) }])
        }
        return // add is terminal: either saved now or awaiting the flex tap
      }
      const result = await run(step.tool, step.args, userId, now())
      console.log(`[line] tool ${step.tool}: ${step.args} -> ${result}`)
      history += `\nassistant: tool ${step.tool}(${step.args})\nresult: ${result}`
    }

    console.log(`[line] reply: ${final}`)
    await client.pushMessage(lineUserId, [{ type: 'flex', altText: final, contents: textFlex(final) }])
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    // Show the real cause on LINE and in the logs — the POC has one user, so
    // the raw message is safe to leak here.
    console.error('[line] failed:', error)
    await client.pushMessage(lineUserId, [{ type: 'flex', altText: `จดไม่สำเร็จ: ${reason}`, contents: textFlex(`จดไม่สำเร็จ: ${reason}`) }])
  }
}
