// LINE Messaging API webhook. Read the raw body, then hand text-message events
// to the natural-language handler (Apple Foundation Model + tools).
import { Hono } from 'hono'
import { processLineEvent, type LineEvent } from '../line-handler'

export const lineRoutes = new Hono()

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
