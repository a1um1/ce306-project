import { createAuthClient } from 'better-auth/react'

// No baseURL = same origin, i.e. `/api/auth` through the web server's proxy to
// the API. Set VITE_API_URL only when the browser calls the API directly.
export const authClient = createAuthClient({ baseURL: import.meta.env.VITE_API_URL || undefined })
