import 'dotenv/config'
import { serve } from '@hono/node-server'
import { app } from './app'

const port = Number(process.env.API_PORT ?? 3001)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] payTail API listening on http://localhost:${info.port}`)
})
