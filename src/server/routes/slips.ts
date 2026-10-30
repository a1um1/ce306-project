import { Hono } from 'hono'
import type { SlipRead } from '@/lib/api/types'
import { requireUser } from '../auth-context'
import { readSlipImages } from '../slip-reader'

export const slipRoutes = new Hono()

slipRoutes.post('/read', async (c) => {
  await requireUser(c)
  const { dataUrls } = await c.req.json<{ dataUrls: string[] }>()
  if (dataUrls.length === 0) return c.json([])
  try {
    return c.json(await readSlipImages(dataUrls))
  } catch {
    return c.json(dataUrls.map((): SlipRead | null => null))
  }
})
