// Deterministic command router. Runs BEFORE any LLM call: these exact words
// never reach the memo parser. Anything else is a memo (or a link code).
export type Command =
  | { kind: 'summary'; scope: 'today' | 'month' }
  | { kind: 'delete-last' }
  | { kind: 'help' }

const COMMANDS: { key: string; command: Command }[] = [
  { key: 'สรุปวันนี้', command: { kind: 'summary', scope: 'today' } },
  { key: 'สรุปเดือนนี้', command: { kind: 'summary', scope: 'month' } },
  { key: 'ลบล่าสุด', command: { kind: 'delete-last' } },
  { key: 'ช่วยเหลือ', command: { kind: 'help' } },
  { key: 'help', command: { kind: 'help' } },
]

export function routeCommand(text: string): Command | null {
  const key = text.trim().toLowerCase()
  return COMMANDS.find((c) => c.key === key)?.command ?? null
}
