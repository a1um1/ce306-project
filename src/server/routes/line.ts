// LINE Messaging API webhook + the web-side account-linking endpoints.
//
// Webhook: LINE signs every request with the channel secret
// (base64(HMAC-SHA256(rawBody, secret)) in x-line-signature). Read the body as
// text and verify before parsing, or LINE will — and does — retry forever.
// Reply 200 for accepted events, then process them out-of-band: one slow or
// failing event must not block the others.
import { HTTPException } from 'hono/http-exception'
import { randomInt } from 'node:crypto'
import { Hono } from 'hono'
import { verifyLineSignature } from '@/lib/utils/line-verify'
import { requireUser } from '../auth-context'
import { processLineEvent, type WebhookEvent } from '../line-handler'
import {
  countLinkCodesInHour,
  isUserLinked,
  latestUnusedCode,
  replaceLinkCode,
  unlinkUser,
} from '../line-event-store'

export const lineRoutes = new Hono()

// No 0/O, 1/I — those are too easy to confuse when typed into LINE.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LIFETIME_MS = 10 * 60 * 1000
const RATE_LIMIT_PER_HOUR = 5

function generateCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

// processLineEvent catches everything internally, so the fire-and-forget below
// can never reject. Returning 200 before the work runs keeps LINE from retrying.
lineRoutes.post('/webhook', async (c) => {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) return c.json({ error: 'LINE_CHANNEL_SECRET not set' }, 503)

  const body = await c.req.text()
  const signature = c.req.header('x-line-signature')
  if (!signature || !verifyLineSignature(secret, body, signature)) {
    return c.json({ error: 'Bad signature' }, 401)
  }

  let payload: { events?: WebhookEvent[] }
  try {
    payload = JSON.parse(body)
  } catch {
    return c.json({ error: 'Bad JSON' }, 400)
  }

  for (const event of payload.events ?? []) {
    void processLineEvent(event)
  }
  return c.json({ ok: true })
})

// Web-side linking UI endpoints. Best Auth owns the session; requireUser guards.

lineRoutes.get('/link', async (c) => {
  const user = await requireUser(c)
  return c.json({
    linked: await isUserLinked(user.id),
    basicId: process.env.LINE_BOT_BASIC_ID ?? null,
  })
})

// The currently active code, for re-showing after a reload. null when none.
lineRoutes.get('/link-code', async (c) => {
  const user = await requireUser(c)
  const code = await latestUnusedCode(user.id, new Date())
  return c.json(code ? { code: code.code, expiresAt: code.expiresAt.toISOString() } : null)
})

lineRoutes.post('/link-code', async (c) => {
  const user = await requireUser(c)
  const now = new Date()
  const since = new Date(now.getTime() - 60 * 60 * 1000)
  if ((await countLinkCodesInHour(user.id, since)) >= RATE_LIMIT_PER_HOUR) {
    throw new HTTPException(429, { message: 'สร้างรหัสได้ 5 ครั้งต่อชั่วโมง' })
  }
  const code = generateCode()
  const expiresAt = new Date(now.getTime() + CODE_LIFETIME_MS)
  await replaceLinkCode(user.id, code, expiresAt)
  return c.json({ code, expiresAt: expiresAt.toISOString() })
})

lineRoutes.delete('/link', async (c) => {
  const user = await requireUser(c)
  await unlinkUser(user.id)
  return c.json({ ok: true })
})
