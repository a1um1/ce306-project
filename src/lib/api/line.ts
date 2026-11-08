import { apiFetch } from './client'
import type { LineAccount } from './types'

export type { LineAccount } from './types'

// The LINE account the user linked via OAuth; null when not linked.
export function getLineAccount(): Promise<LineAccount> {
  return apiFetch<LineAccount>('/api/line/account')
}
