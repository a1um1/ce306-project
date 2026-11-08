// LINE Messaging API client. Every call swallows errors (logs, keeps the app
// alive) so a dead network can never crash the webhook. Retries once on 5xx:
// LINE replies and pushes both fail silently and retryable over 5xx.
const MESSAGE_API = 'https://api.line.me/v2/bot/message'
const CONTENT_API = 'https://api-data.line.me/v2/bot/message'
// A reply token is only valid for ~10 seconds after the event lands.
const MAX_ATTEMPTS = 2

export type QuickReplyAction = { type: 'postback'; label: string; data: string; displayText?: string }
export type LineTextMessage = {
  type: 'text'
  text: string
  quickReply?: { items: { type: 'action'; action: QuickReplyAction }[] }
}
export type LineMessage = LineTextMessage | { type: 'flex'; altText: string; contents: unknown }

export type Client = {
  replyMessage: typeof replyMessage
  pushMessage: typeof pushMessage
  fetchImageData: typeof fetchImageData
}

function token() {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN
}

async function send(url: string, body: object): Promise<boolean> {
  const accessToken = token()
  if (!accessToken) return false // not configured: dev without LINE
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      })
      if (res.ok) return true
      if (res.status < 500) return false // 4xx will never succeed by retrying
      if (attempt === MAX_ATTEMPTS) return false
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        console.error('[line] send failed:', url, error instanceof Error ? error.message : error)
        return false
      }
    }
  }
  return false
}

// Reply to a webhook event while its token is still fresh.
export async function replyMessage(replyToken: string, messages: LineMessage[]): Promise<boolean> {
  if (!replyToken) return false
  return send(`${MESSAGE_API}/reply`, { replyToken, messages })
}

// Push a message to a user outside the reply window (follow-ups).
export async function pushMessage(lineUserId: string, messages: LineMessage[]): Promise<boolean> {
  if (!lineUserId) return false
  const ok = await send(`${MESSAGE_API}/push`, { to: lineUserId, messages })
  if (!ok) console.error('[line] push failed')
  return ok
}

// Fetch a message image's bytes for the slip reader. LINE serves the raw JPEG
// zero-padded to the original file size — trim the trailing zeros or OCR sees
// a giant empty band. Content is only fetchable for a short window after the
// event, so this must run before the model loop.
export async function fetchImageData(messageId: string): Promise<string | null> {
  const accessToken = token()
  if (!accessToken) return null // not configured: dev without LINE
  try {
    const res = await fetch(`${CONTENT_API}/${messageId}/content`, {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      console.error(`[line] content fetch failed: ${res.status}`)
      return null
    }
    const raw = new Uint8Array(await res.arrayBuffer())
    let end = raw.length
    while (end > 0 && raw[end - 1] === 0) end--
    return `data:image/jpeg;base64,${Buffer.from(raw.subarray(0, end)).toString('base64')}`
  } catch (error) {
    console.error('[line] content fetch failed:', error instanceof Error ? error.message : error)
    return null
  }
}
