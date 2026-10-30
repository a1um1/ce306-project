import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { auth } from '@/lib/auth'
import type { SessionUser } from '@/lib/api/types'

// Every data endpoint resolves the user through here.
export async function requireUser(c: Context): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) throw new HTTPException(401, { message: 'Unauthorized' })
  return session.user as SessionUser
}
