// Dev helper: expose the local API through a Cloudflare quick tunnel and point
// the LINE Messaging API webhook at it. Quick-tunnel URLs change on every run,
// so this re-sets the endpoint each time `bun run dev` starts.
import 'dotenv/config'
import { spawn } from 'node:child_process'

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
const port = process.env.API_PORT ?? '3001'

if (!token) {
  console.log('[line] LINE_CHANNEL_ACCESS_TOKEN not set, skipping tunnel')
  process.exit(0)
}

const child = spawn(
  'cloudflared',
  ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'],
  { stdio: ['ignore', 'pipe', 'pipe'] },
)

child.on('error', (error) => {
  console.warn('[line] cloudflared failed to start:', error.message)
  process.exit(0) // dev convenience only: do not take the dev server down
})

let done = false
const URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/

// A quick tunnel needs a few seconds to propagate. LINE validates the URL when
// setting it, so retry the 400 that means "not reachable yet".
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function setEndpoint(origin: string) {
  const endpoint = `${origin}/api/line/webhook`
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}` }
  console.log(`[line] setting webhook -> ${endpoint}`)
  try {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ endpoint }),
      })
      if (res.ok) break
      const detail = `${res.status} ${await res.text()}`
      const retryable = res.status === 400 || res.status >= 500
      if (!retryable || attempt === 20) {
        console.warn(`[line] could not set webhook: ${detail}`)
        return
      }
      await sleep(3000)
    }
    console.log(`[line] webhook -> ${endpoint}`)

    // LINE calls the endpoint back; failure here means the API is not up yet.
    const test = await fetch('https://api.line.me/v2/bot/channel/webhook/test', {
      method: 'POST',
      headers,
      body: JSON.stringify({ endpoint }),
    })
    const result = (await test.json()) as { success?: boolean; message?: string }
    console.log(`[line] webhook test: ${result.success ? 'ok' : result.message ?? 'failed'}`)
  } catch (error) {
    console.warn('[line] could not set webhook:', error instanceof Error ? error.message : error)
  }
}

function watch(stream: NodeJS.ReadableStream) {
  stream.on('data', (chunk: Buffer) => {
    if (done) return
    const match = chunk.toString().match(URL_PATTERN)
    if (!match) return
    done = true
    void setEndpoint(match[0])
  })
}

watch(child.stdout)
watch(child.stderr)

child.on('exit', (code) => {
  console.warn(`[line] cloudflared exited with code ${code}`)
  process.exit(0)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    child.kill(signal)
    // cloudflared normally exits on the signal; force it if it hangs.
    setTimeout(() => {
      child.kill('SIGKILL')
      process.exit(0)
    }, 2000).unref()
  })
}
