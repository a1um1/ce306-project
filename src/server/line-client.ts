// LINE Messaging API client. Every call swallows errors (logs, keeps the app
// alive) so a dead network can never crash the webhook. Retries once on 5xx:
// LINE replies and pushes both fail silently and retryable over 5xx.
const API = 'https://api.line.me/v2/bot/message'
// A reply token is only valid for ~10 seconds after the event lands.
const MAX_ATTEMPTS = 2

export type QuickReplyAction = { type: 'postback'; label: string; data: string; displayText?: string }
export type LineTextMessage = {
  type: 'text'
  text: string
  quickReply?: { items: { type: 'action'; action: QuickReplyAction }[] }
}
export type LineMessage = LineTextMessage | { type: 'flex'; altText: string; contents: unknown }

export type Client = { replyMessage: typeof replyMessage; pushMessage: typeof pushMessage }

function token() {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN
}

async function send(path: string, body: object): Promise<boolean> {
  const accessToken = token()
  if (!accessToken) return false // not configured: dev without LINE
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${API}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      })
      if (res.ok) return true
      if (res.status < 500) return false // 4xx will never succeed by retrying
      if (attempt === MAX_ATTEMPTS) return false
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        console.error('[line] send failed:', path, error instanceof Error ? error.message : error)
        return false
      }
    }
  }
  return false
}

// Reply to a webhook event while its token is still fresh.
export async function replyMessage(replyToken: string, messages: LineMessage[]): Promise<boolean> {
  if (!replyToken) return false
  return send('reply', { replyToken, messages })
}

// Push a message to a user outside the reply window (follow-ups).
export async function pushMessage(lineUserId: string, messages: LineMessage[]): Promise<boolean> {
  if (!lineUserId) return false
  const ok = await send('push', { to: lineUserId, messages })
  if (!ok) console.error('[line] push failed')
  return ok
}
