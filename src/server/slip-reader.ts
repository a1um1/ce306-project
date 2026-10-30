import type { SlipRead } from '@/lib/api/types'
import { readSlipImages as readLocally } from '../../tools/slip-reader/reader.ts'

async function readRemotely(baseUrl: string, dataUrls: string[]): Promise<(SlipRead | null)[]> {
  const token = process.env.SLIP_READER_TOKEN
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/read`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ dataUrls }),
  })
  if (!response.ok) throw new Error(`slip reader returned ${response.status}`)
  return (await response.json()) as (SlipRead | null)[]
}

// SLIP_READER_URL points at the OCR service (`pnpm slips:serve`). Unset, the
// macOS binary runs in-process, which is the zero-setup path for local dev.
export async function readSlipImages(dataUrls: string[]): Promise<(SlipRead | null)[]> {
  if (dataUrls.length === 0) return []
  const remote = process.env.SLIP_READER_URL
  if (remote) return readRemotely(remote, dataUrls)
  return readLocally(dataUrls)
}
