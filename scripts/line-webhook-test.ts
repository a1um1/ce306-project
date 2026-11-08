// Local fake-webhook sender: signs a real LINE request and POSTs it straight at
// the local API, so the whole webhook path (signature check, 200-ack, async
// processing) can be exercised without a tunnel or the LINE servers. Run with
// `bun run line:test` while `bun run dev:api` is listening.
//
// Usage: bun run line:test [text] [userId]
//   default text: ปลาทู 40
//   default userId: U-auth-testing (hash stable, not owned by any real user)
import 'dotenv/config'
import { createHmac } from 'node:crypto'

const secret = process.env.LINE_CHANNEL_SECRET
if (!secret) {
  console.error('LINE_CHANNEL_SECRET not set in .env')
  process.exit(1)
}

const [, , textArg, userArg] = process.argv
const text = textArg ?? 'ปลาทู 40'
const userId = userArg ?? 'U-auth-testing'
const base = process.env.API_BASE_URL ?? 'http://localhost:3001'

const event = {
  type: 'message',
  id: `test-${Date.now()}`,
  timestamp: Date.now(),
  source: { userId },
  replyToken: 'test-reply-token',
  message: { id: 'test-message' + Date.now(), type: 'text', text },
}

const payload = JSON.stringify({ destination: 'test', events: [event] })
const signature = createHmac('sha256', secret).update(payload).digest('base64')

const res = await fetch(`${base}/api/line/webhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-line-signature': signature },
  body: payload,
})
console.log(`→ ${base}/api/line/webhook`)
console.log(`  event ${event.id}, text: ${text}, user: ${userId}`)
console.log(`  ${res.status} ${await res.text()}`)
