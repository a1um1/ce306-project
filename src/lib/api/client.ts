import { createIsomorphicFn } from '@tanstack/react-start'

// The browser reaches the API on the web origin (`/api`), which Vite proxies in
// dev and a reverse proxy does in production. Set VITE_API_URL only when the
// API is served from another origin.
const apiBase = createIsomorphicFn()
  .server(() => process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? 3001}`)
  .client(() => import.meta.env.VITE_API_URL ?? '')

// A server-side render calls the API directly, so the incoming browser cookies
// have to travel with the request. The client lets the browser attach them.
const forwardedHeaders = createIsomorphicFn()
  .server(async () => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const incoming = getRequestHeaders()
    const headers = new Headers()
    const cookie = incoming.get('cookie')
    if (cookie) headers.set('cookie', cookie)
    const authorization = incoming.get('authorization')
    if (authorization) headers.set('authorization', authorization)
    return headers
  })
  .client(() => new Headers())

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function apiUrl(path: string): string {
  return `${apiBase()}${path}`
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await forwardedHeaders()
  new Headers(init.headers).forEach((value, key) => headers.set(key, value))
  if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(payload?.error ?? `Request failed (${response.status})`, response.status)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
