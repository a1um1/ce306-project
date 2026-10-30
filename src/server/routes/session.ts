import { Hono } from 'hono'
import { auth } from '@/lib/auth'

export const sessionRoutes = new Hono()

// Null when signed out; the route guards read this on every navigation.
sessionRoutes.get('/session', async (c) => {
  return c.json(await auth.api.getSession({ headers: c.req.raw.headers }))
})
