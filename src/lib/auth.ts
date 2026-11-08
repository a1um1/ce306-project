import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { db } from '@/db'
import * as schema from '@/db/schema'

// Runs inside the Hono API. Best Auth sets its own cookies on the response it
// returns, so no framework integration plugin is needed.
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  // Requests reach the API from the web origin (proxied or cross-origin).
  trustedOrigins: [process.env.WEB_ORIGIN ?? 'http://localhost:3000'],
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    line: {
      clientId: process.env.LINE_CLIENT_ID!,
      clientSecret: process.env.LINE_CLIENT_SECRET!,
    },
  },
})
