import { createHmac, timingSafeEqual } from 'node:crypto'

// LINE signs every webhook request: base64(HMAC-SHA256(rawBody, channelSecret))
// in the x-line-signature header. Verify over the raw text, not the parsed JSON,
// and compare in constant time.
export function verifyLineSignature(secret: string, rawBody: string, signature: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}
