import { createHash } from 'node:crypto'

// Hash the LINE user id before it goes into logs/errors so a log dump can't be
// matched back to a real account. Never log tokens or the channel secret.
export function hashLineUser(lineUserId: string): string {
  return createHash('sha256').update(lineUserId).digest('hex').slice(0, 12)
}

// Line-structured JSON log line, one event = one line for greppable ops logs.
export function logEvent(
  eventId: string,
  type: string,
  fields: Record<string, string | number>,
): void {
  console.log(`[line] ${JSON.stringify({ eventId, type, ...fields })}`)
}
