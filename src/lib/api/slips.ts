import { apiFetch } from './client'
import type { SlipRead } from './types'

export type { SlipRead } from './types'

export function readSlips(dataUrls: string[]): Promise<(SlipRead | null)[]> {
  return apiFetch<(SlipRead | null)[]>('/api/slips/read', {
    method: 'POST',
    body: JSON.stringify({ dataUrls }),
  })
}
