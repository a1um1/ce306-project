import { routeCommand } from '@/lib/command-router'
import { normalizeText } from '@/lib/utils/categorize'
import { formatAmount } from '@/lib/utils/format'
import {
  LlmMemoParser,
  MemoParseError,
  defaultTimezone,
  occurredAtFor,
  todayInTz,
  type MemoParser,
  type ParsedItem,
} from '@/lib/utils/memo-parser'
import { pushMessage, replyMessage, type Client, type LineTextMessage } from './line-client'
import { dbLineStore, type LineStore } from './line-event-store'
import { hashLineUser, logEvent } from './line-log'

// One LINE webhook event as delivered. Only the fields we read are typed.
export type WebhookEvent = {
  id: string
  type: string
  replyToken?: string
  source?: { userId?: string }
  message?: { id: string; type: string; text?: string }
  postback?: { data?: string }
  deliveryContext?: { isRedelivery?: boolean }
  [key: string]: unknown
}

export type Pending = {
  action: 'complete' | 'edit'
  rawText?: string
  expenseId?: string
  expiresAt: number
}

export type HandlerDeps = {
  client?: Client
  parser?: MemoParser
  store?: LineStore
  now?: () => Date
}

const LINK_CODE_RE = /^[A-Z0-9]{6}$/i
const PENDING_TTL_MS = 5 * 60 * 1000
const LLM_HOURLY_LIMIT = 30

const AUDIO_IMAGE_NOTICE = 'ตอนนี้รองรับข้อความอย่างเดียวนะ เร็วๆ นี้จะรองรับเสียงและสลิป'
const NOT_LINKED_TEXT =
  'ยังไม่ได้เชื่อมต่อบัญชีครับ 🔗\nเข้าเว็บ > การตั้งค่า > เชื่อมต่อ LINE แล้วกด "สร้างรหัสเชื่อมต่อ"\nจากนั้นส่งรหัส 6 ตัวมาที่นี่ครับ'
const HELP_TEXT = [
  'พิมพ์แบบนี้ได้เลยครับ 📝',
  '· จดรายจ่าย: ปลาทู 40',
  '· รายรับ: เงินเดือน 25000',
  '· หลายรายการ: ข้าว 50 น้ำ 20',
  '· ระบุวัน: เมื่อวานข้าวมันไก่ 55',
  '· สรุปวันนี้ / สรุปเดือนนี้',
  '· ลบล่าสุด',
  'ยังไม่ได้เชื่อมต่อ? สร้างรหัสที่เว็บ แล้วส่งรหัส 6 ตัวให้บอทครับ',
].join('\n')

function addFriendHint(): string {
  const basic = process.env.LINE_BOT_BASIC_ID
  return basic
    ? '\nเพิ่มบอท: https://line.me/R/ti/p/' + basic
    : '\n(เพิ่มบอท: ตั้งค่า LINE_BOT_BASIC_ID)'
}

const WELCOME_TEXT =
  'ยินดีต้อนรับครับ 🙏\nพิมพ์ "ช่วยเหลือ" เพื่อดูคำสั่ง\nก่อนจดรายการใช้ ยังต้องเชื่อมต่อบัญชีที่เว็บก่อนครับ' + addFriendHint()

// ---------------------------------------------------------------------------
// In-memory rate limiter + pending state (single-node: fine in this process)
// ---------------------------------------------------------------------------

const llmCalls = new Map<string, number[]>()
const pendingState = new Map<string, Pending>()

export function resetLineRuntime() {
  llmCalls.clear()
  pendingState.clear()
}

export function allowLlmCall(userId: string, now = new Date()): boolean {
  const hourAgo = now.getTime() - 60 * 60 * 1000
  const stamped = (llmCalls.get(userId) ?? []).filter((t) => t > hourAgo)
  if (stamped.length >= LLM_HOURLY_LIMIT) {
    llmCalls.set(userId, stamped)
    return false
  }
  stamped.push(now.getTime())
  llmCalls.set(userId, stamped)
  return true
}

function readPending(userId: string, now: Date): Pending | null {
  const p = pendingState.get(userId)
  if (!p || p.expiresAt <= now.getTime()) {
    pendingState.delete(userId)
    return null
  }
  return p
}

const DEFAULT_DEPS: HandlerDeps = {}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function processLineEvent(event: WebhookEvent, deps: HandlerDeps = {}): Promise<void> {
  const { client = { replyMessage, pushMessage }, parser = new LlmMemoParser(), store = dbLineStore, now = () => new Date() } = deps
  const started = performance.now()
  const lineUserId = event.source?.userId ?? ''
  const hashed = hashLineUser(lineUserId)

  try {
    const inserted = await store.beginEvent(event.id, event.type, event)
    if (inserted === 'duplicate') {
      logEvent(event.id, event.type, { userId: hashed, duplicate: 1 })
      return
    }

    switch (event.type) {
      case 'message':
        await handleMessage(event, { client, parser, store, now })
        break
      case 'follow':
        await client.replyMessage(event.replyToken ?? '', [{ type: 'text', text: WELCOME_TEXT }])
        break
      case 'postback':
        await handlePostback(event, { client, store })
        break
      default:
        // unknown types (unsend, join, beacon, ...): acknowledge, do nothing
        break
    }
    await store.finishEvent(event.id, true)
    logEvent(event.id, event.type, {
      userId: hashed,
      ms: Math.round(performance.now() - started),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await store.finishEvent(event.id, false, message)
    logEvent(event.id, event.type, {
      userId: hashed,
      ms: Math.round(performance.now() - started),
      error: message,
    })
  }
}

async function handleMessage(
  event: WebhookEvent,
  deps: Required<HandlerDeps>,
): Promise<void> {
  const msg = event.message
  const lineUserId = event.source?.userId ?? ''
  if (!msg || !lineUserId) return
  if (msg.type !== 'text') {
    if (msg.type === 'audio' || msg.type === 'image') {
      await deps.client.replyMessage(event.replyToken ?? '', [{ type: 'text', text: AUDIO_IMAGE_NOTICE }])
    }
    return
  }

  const link = await deps.store.findLink(lineUserId)
  const text = msg.text ?? ''
  if (!link) {
    await handleUnlinked(lineUserId, text, event, deps)
    return
  }
  await handleLinked(link.userId, lineUserId, text, event, deps)
}

// -- unlinked: accept only a 6-char code; anything else just gets instructions
async function handleUnlinked(
  lineUserId: string,
  text: string,
  event: WebhookEvent,
  deps: Required<HandlerDeps>,
): Promise<void> {
  const stripped = text.trim()
  if (LINK_CODE_RE.test(stripped)) {
    const code = await deps.store.findCode(stripped, deps.now())
    if (code) {
      await deps.store.createLink(code.userId, lineUserId, deps.now())
      await deps.store.markCodeUsed(code.code, deps.now())
      await deps.client.replyMessage(event.replyToken ?? '', [
        { type: 'text', text: 'เชื่อมต่อสำเร็จ 🎉 ลองพิมพ์: ปลาทู 40' },
      ])
    } else {
      await deps.client.replyMessage(event.replyToken ?? '', [
        { type: 'text', text: 'รหัสไม่ถูกต้องหรือหมดอายุ สร้างใหม่ที่เว็บได้เลย' },
      ])
    }
    return
  }
  await deps.client.replyMessage(event.replyToken ?? '', [
    { type: 'text', text: NOT_LINKED_TEXT + addFriendHint() },
  ])
}

// -- linked: commands, then memo parsing
async function handleLinked(
  userId: string,
  lineUserId: string,
  text: string,
  event: WebhookEvent,
  deps: Required<HandlerDeps>,
): Promise<void> {
  const command = routeCommand(text)
  if (command) {
    await runCommand(userId, command.kind, 'scope' in command ? command.scope : undefined, event, deps)
    return
  }

  const pending = readPending(userId, deps.now())
  if (pending) {
    await completePending(userId, lineUserId, pending, text, event, deps)
    return
  }

  await parseAndSaveMemo(userId, lineUserId, text, event, deps)
}

async function runCommand(
  userId: string,
  kind: 'summary' | 'delete-last' | 'help',
  scope: 'today' | 'month' | undefined,
  event: WebhookEvent,
  deps: Required<HandlerDeps>,
): Promise<void> {
  if (kind === 'help') {
    await deps.client.replyMessage(event.replyToken ?? '', [{ type: 'text', text: HELP_TEXT }])
    return
  }
  if (kind === 'delete-last') {
    const row = await deps.store.latestLineExpense(userId)
    if (!row) {
      await deps.client.replyMessage(event.replyToken ?? '', [
        { type: 'text', text: 'ยังไม่มีรายการที่จดผ่าน LINE ให้ลบครับ' },
      ])
      return
    }
    await deps.store.softDeleteExpense(row.id, userId)
    await deps.client.replyMessage(event.replyToken ?? '', [
      { type: 'text', text: `ลบแล้ว ✅ ${row.title} ฿${formatAmount(row.amount)}` },
    ])
    return
  }
  const summary = await deps.store.summary(userId, scope!)
  const period = scope === 'today' ? 'วันนี้' : 'เดือนนี้'
  const totalLine = `ใช้จ่ายรวม ฿${formatAmount(summary.total)} (${summary.count} รายการ)`
  let topLine = ''
  if (summary.top.length > 0) {
    if (scope === 'today') {
      const t = summary.top[0]
      topLine = `\nหมวดสูงสุด: ${t.name} ฿${formatAmount(t.sum)}`
    } else {
      topLine = '\nหมวดสูงสุด 3 อันดับ: ' + summary.top.map((t) => `${t.name} ${formatAmount(t.sum)}`).join(' · ')
    }
  }
  const income = summary.income > 0 ? `\nรายรับ ฿${formatAmount(summary.income)}` : ''
  await deps.client.replyMessage(event.replyToken ?? '', [
    { type: 'text', text: `สรุป${period} 📊\n${totalLine}${topLine}${income}` },
  ])
}

// ---------------------------------------------------------------------------
// Memo parsing + saving
// ---------------------------------------------------------------------------

type SaveResult = { parsed: ParsedItem[]; categories: { id: string; name: string }[] }

async function parseViaLlm(
  userId: string,
  text: string,
  deps: Required<HandlerDeps>,
): Promise<{ memo: ParsedResult } | { error: string }> {
  if (!allowLlmCall(userId, deps.now())) {
    return { error: 'RATE' }
  }
  const categories = await deps.store.categories(userId)
  try {
    const memo = await deps.parser.parse(text, {
      now: deps.now(),
      timezone: defaultTimezone(),
      userCategories: categories.map((c) => c.name),
    })
    return { memo: { ...memo, categories } }
  } catch (error) {
    const kind = error instanceof MemoParseError ? 'PARSE' : 'LLM'
    return { error: kind }
  }
}

type ParsedResult = {
  items: ParsedItem[]
  needsClarification: string | null
  confidence: number
  categories: { id: string; name: string }[]
}

// Map a parsed category NAME to the user's category id; close match only.
function matchCategoryId(
  name: string | null,
  categories: { id: string; name: string }[],
): string | null {
  if (!name) return null
  const target = normalizeText(name)
  return categories.find((c) => normalizeText(c.name) === target)?.id ?? null
}

function replyTokenOf(event: WebhookEvent): string {
  return event.replyToken ?? ''
}

async function parseAndSaveMemo(
  userId: string,
  lineUserId: string,
  text: string,
  event: WebhookEvent,
  deps: Required<HandlerDeps>,
): Promise<void> {
  const ack = await deps.client.replyMessage(replyTokenOf(event), [
    { type: 'text', text: 'กำลังจดให้ครับ ⏳' },
  ])
  // Ack first so LINE never sees a late reply; results arrive by push.
  void ack

  const parsed = await parseViaLlm(userId, text, deps)
  if ('error' in parsed) {
    await deps.store.finishEvent(event.id, false, parsed.error)
    const msg =
      parsed.error === 'RATE'
        ? 'จดเยอะเกินไปแล้วในชั่วโมงนี้ ลองใหม่อีกครั้งภายหลังนะครับ 🙏'
        : 'ขอโทษ จดไม่สำเร็จ ลองพิมพ์ใหม่อีกครั้งนะ'
    await deps.client.pushMessage(lineUserId, [{ type: 'text', text: msg }])
    return
  }
  await saveMemo(userId, lineUserId, parsed.memo, event, deps, text)
}

async function completePending(
  userId: string,
  lineUserId: string,
  pending: Pending,
  text: string,
  event: WebhookEvent,
  deps: Required<HandlerDeps>,
): Promise<void> {
  if (pending.action === 'edit' && pending.expenseId) {
    const parsed = await parseViaLlm(userId, text, deps)
    if ('error' in parsed) {
      const msg =
        parsed.error === 'RATE'
          ? 'จดเยอะเกินไปแล้วในชั่วโมงนี้ ลองใหม่อีกครั้งภายหลังนะครับ 🙏'
          : 'ขอโทษ จดไม่สำเร็จ ลองพิมพ์ใหม่อีกครั้งนะ'
      await deps.client.replyMessage(replyTokenOf(event), [{ type: 'text', text: msg }])
      return
    }
    const item = parsed.memo.items[0]
    if (!item) {
      await deps.client.replyMessage(replyTokenOf(event), [
        { type: 'text', text: 'พิมพ์รายการใหม่ครับ เช่น: ปลาทู 40' },
      ])
      return
    }
    pendingState.delete(userId)
    const categoryId = matchCategoryId(item.category, parsed.memo.categories)
    await deps.store.replaceExpense(pending.expenseId, userId, {
      title: item.note,
      amount: item.amount,
      type: item.type,
      note: item.note,
      categoryId,
      occurredAt: occurredAtFor(item.date, defaultTimezone(), deps.now()),
    }, text)
    await deps.client.replyMessage(replyTokenOf(event), [
      { type: 'text', text: `แก้ไขแล้ว ✅ ${item.note} ฿${formatAmount(item.amount)}` },
    ])
    return
  }

  // 'complete': the user just answered the amount question
  const combined = `${pending.rawText ?? ''} ${text}`.trim()
  await parseAndSaveMemo(userId, lineUserId, combined, event, deps)
}

async function saveMemo(
  userId: string,
  lineUserId: string,
  memo: ParsedResult,
  event: WebhookEvent,
  deps: Required<HandlerDeps>,
  rawText: string,
): Promise<void> {
  const { items, needsClarification, categories } = memo

  if (items.length === 0) {
    if (needsClarification) {
      // Missing amount: keep a 5-minute pending so the next message completes it.
      pendingState.set(userId, {
        action: 'complete',
        rawText,
        expiresAt: deps.now().getTime() + PENDING_TTL_MS,
      })
      await deps.client.pushMessage(lineUserId, [
        { type: 'text', text: needsClarification },
      ])
      return
    }
    // Greeting / chat with no expense meaning: friendly, nothing saved.
    await deps.client.pushMessage(lineUserId, [
      { type: 'text', text: 'พิมพ์แบบนี้เพื่อจดรายการครับ เช่น: ปลาทู 40 หรือ "ช่วยเหลือ" สำหรับคำสั่ง' },
    ])
    return
  }

  const rows = items.map((item) => ({
    title: item.note,
    amount: item.amount,
    type: item.type,
    note: item.note,
    categoryId: matchCategoryId(item.category, categories),
    occurredAt: occurredAtFor(item.date, defaultTimezone(), deps.now()),
  }))
  const saved = await deps.store.insertExpenses(userId, rows, rawText)

  const today = todayInTz(defaultTimezone(), deps.now())
  const messages: LineTextMessage[] = []
  saved.forEach((row, index) => {
    const item = items[index]
    const catName = item && categories.find((c) => c.id === rows[index].categoryId)?.name
    const when = item && item.date && item.date !== today ? String(item.date) : 'วันนี้'
    const mark = rows[index].type === 'income' ? 'รับ' : 'จด'
    const quick = quickRepliesFor(rows[index], row.id, categories, catName ?? null)
    messages.push({
      type: 'text',
      text: `${mark}แล้ว ✅ ${row.title} ฿${formatAmount(row.amount)} · ${catName ?? 'ไม่ระบุหมวด'} · ${when}`,
      quickReply: quick ? { items: quick } : undefined,
    })
  })
  await deps.client.pushMessage(lineUserId, messages)
}

function quickRepliesFor(
  row: { categoryId: string | null },
  expenseId: string,
  categories: { id: string; name: string }[],
  currentCategoryIdOrName: string | null,
): { type: 'action'; action: { type: 'postback'; label: string; data: string; displayText?: string } }[] | null {
  const items: { type: 'action'; action: { type: 'postback'; label: string; data: string; displayText?: string } }[] = [
    { type: 'action', action: { type: 'postback', label: 'แก้ไข', data: `paytail:edit:${expenseId}` } },
    { type: 'action', action: { type: 'postback', label: 'ลบ', data: `paytail:delete:${expenseId}` } },
  ]
  // Offer re-categorisation, up to 4 categories, only when the item has none.
  if (!row.categoryId) {
    const pool = categories.filter(
      (c) => c.name !== currentCategoryIdOrName && !row.categoryId?.includes(c.id),
    ).slice(0, 4)
    for (const c of pool) {
      items.push({
        type: 'action',
        action: { type: 'postback', label: c.name, data: `paytail:cat:${expenseId}:${c.id}` },
      })
    }
  }
  return items
}

// ---------------------------------------------------------------------------
// Postback quick-reply actions
// ---------------------------------------------------------------------------

async function handlePostback(
  event: WebhookEvent,
  deps: { client: Client; store: LineStore },
): Promise<void> {
  const lineUserId = event.source?.userId ?? ''
  if (!event.postback?.data || !lineUserId) return
  const link = await deps.store.findLink(lineUserId)
  if (!link) {
    await deps.client.replyMessage(replyTokenOf(event), [
      { type: 'text', text: 'ยังไม่ได้เชื่อมต่อบัญชีกับ LINE ครับ' },
    ])
    return
  }
  const [ns, action, rawId, categoryId] = event.postback.data.split(':')
  if (ns !== 'paytail') return
  const expenseId = rawId ?? ''

  if (action === 'delete') {
    // Ownership check: only this linked user's expense is visible.
    if (!(await deps.store.getExpense(expenseId, link.userId))) {
      await deps.client.replyMessage(replyTokenOf(event), [{ type: 'text', text: 'ไม่พบรายการครับ' }])
      return
    }
    await deps.store.softDeleteExpense(expenseId, link.userId)
    await deps.client.replyMessage(replyTokenOf(event), [{ type: 'text', text: 'ลบแล้ว ✅' }])
    return
  }
  if (action === 'cat' && categoryId) {
    if (!(await deps.store.getExpense(expenseId, link.userId))) {
      await deps.client.replyMessage(replyTokenOf(event), [{ type: 'text', text: 'ไม่พบรายการครับ' }])
      return
    }
    await deps.store.setExpenseCategory(expenseId, link.userId, categoryId)
    await deps.client.replyMessage(replyTokenOf(event), [{ type: 'text', text: 'เปลี่ยนหมวดแล้ว ✅' }])
    return
  }
  if (action === 'edit') {
    if (!(await deps.store.getExpense(expenseId, link.userId))) {
      await deps.client.replyMessage(replyTokenOf(event), [{ type: 'text', text: 'ไม่พบรายการครับ' }])
      return
    }
    pendingState.set(link.userId, {
      action: 'edit',
      expenseId,
      expiresAt: Date.now() + PENDING_TTL_MS,
    })
    await deps.client.replyMessage(replyTokenOf(event), [
      { type: 'text', text: 'พิมพ์รายการใหม่ครับ เช่น: ปลาทู 40' },
    ])
    return
  }
}
