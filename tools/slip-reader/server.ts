#!/usr/bin/env node
// REST wrapper over the macOS Vision OCR binary. Vision only exists on macOS,
// so this service runs natively; the API calls it when SLIP_READER_URL is set.
//
// Run: pnpm slips:serve     (http://127.0.0.1:4100)
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readSlipImages } from './reader.ts'

const port = Number(process.env.SLIP_READER_PORT ?? 4100)
const host = process.env.SLIP_READER_HOST ?? '127.0.0.1'
const token = process.env.SLIP_READER_TOKEN ?? ''

// A batch of phone photos as base64: generous, but bounded.
const MAX_BODY_BYTES = 64 * 1024 * 1024

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('Payload too large')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const server = createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0]

  if (req.method === 'GET' && path === '/health') {
    send(res, 200, { ok: true, engine: 'vision', platform: process.platform })
    return
  }

  if (req.method === 'POST' && path === '/read') {
    if (token && req.headers.authorization !== `Bearer ${token}`) {
      send(res, 401, { error: 'Unauthorized' })
      return
    }

    let payload: { dataUrls?: unknown }
    try {
      payload = JSON.parse(await readBody(req)) as { dataUrls?: unknown }
    } catch (cause) {
      const tooLarge = cause instanceof Error && cause.message === 'Payload too large'
      send(res, tooLarge ? 413 : 400, {
        error: cause instanceof Error ? cause.message : 'Invalid JSON',
      })
      return
    }

    const dataUrls = Array.isArray(payload.dataUrls)
      ? payload.dataUrls.filter((value): value is string => typeof value === 'string')
      : []
    if (dataUrls.length === 0) {
      send(res, 200, [])
      return
    }

    try {
      send(res, 200, await readSlipImages(dataUrls))
    } catch (cause) {
      send(res, 500, { error: cause instanceof Error ? cause.message : String(cause) })
    }
    return
  }

  send(res, 404, { error: 'Not found' })
})

server.listen(port, host, () => {
  console.log(`[slip-reader] listening on http://${host}:${port}`)
})
