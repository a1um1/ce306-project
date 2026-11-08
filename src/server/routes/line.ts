// LINE Messaging API webhook. Read the raw body, then hand text-message events
// to the natural-language handler (Apple Foundation Model + tools).
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '@/db'
import { account } from '@/db/schema'
import { requireUser } from '../auth-context'
import { processLineEvent, type LineEvent } from '../line-handler'

export const lineRoutes = new Hono()

// The LINE account the signed-in user linked via OAuth (settings page). Null
// when not linked. accountId is the LINE user id — the same id the Messaging
// API webhook reports when the LINE Login and Messaging API channels are under
// one provider.
lineRoutes.get('/account', async (c) => {
  const user = await requireUser(c)
  const [row] = await db
    .select({ accountId: account.accountId })
    .from(account)
    .where(and(eq(account.userId, user.id), eq(account.providerId, 'line')))
    .limit(1)
  return c.json(row ? { lineUserId: row.accountId } : null)
})

lineRoutes.post('/webhook', async (c) => {
  // TODO(security): verify the x-line-signature header — base64(HMAC-SHA256
  // of the raw body with LINE_CHANNEL_SECRET) — before trusting events. Skipped
  // for the POC: anyone who can reach this endpoint can inject events.
  const body = await c.req.text()
  let payload: { events?: LineEvent[] }
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
