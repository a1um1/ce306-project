import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '../auth'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  return auth.api.getSession({ headers: getRequestHeaders() })
})

type SessionUser = { id: string; name: string; email: string; image?: string | null }

// Server-fn auth guard. Every data endpoint resolves the user through here.
export const requireUser = createServerOnlyFn(async (): Promise<SessionUser> => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) throw new Error('Unauthorized')
  return session.user as SessionUser
})
