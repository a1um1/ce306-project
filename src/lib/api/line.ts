import { apiFetch } from './client'

export type LinkStatus = {
  linked: boolean
  // Basic id of the bot, for the add-friend link; null when unconfigured.
  basicId: string | null
}
export type LinkCode = { code: string; expiresAt: string }

export function getLinkStatus(): Promise<LinkStatus> {
  return apiFetch<LinkStatus>('/api/line/link')
}

export function getLinkCode(): Promise<LinkCode | null> {
  return apiFetch<LinkCode | null>('/api/line/link-code')
}

export function createLinkCode(): Promise<LinkCode> {
  return apiFetch<LinkCode>('/api/line/link-code', { method: 'POST' })
}

export function unlinkLine(): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>('/api/line/link', { method: 'DELETE' })
}

export function botAddFriendUrl(basicId: string): string {
  return `https://line.me/R/ti/p/${basicId}`
}
