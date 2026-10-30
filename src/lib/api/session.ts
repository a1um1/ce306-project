import { apiFetch } from './client'
import type { Session } from './types'

export type { Session, SessionUser } from './types'

// Null when signed out. Route guards call this on every navigation, so during
// SSR the api client forwards the browser's cookies to the API server.
export function getSession(): Promise<Session> {
  return apiFetch<Session>('/api/session')
}
