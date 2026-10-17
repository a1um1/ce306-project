import jsQR from 'jsqr'

export async function decodeQrFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return jsQR(image.data, image.width, image.height)?.data ?? null
}

// EMVCo TLV walk: Thai slip QRs are EMVCo-shaped — amount lives in tag 54,
// references under tag 62. Unknown layouts fall back to a decimal match.
// shortcut: only amount + ref are read; add more tags when slips need them.
export function parseSlipPayload(payload: string): { amount?: number; ref?: string } {
  const out: { amount?: number; ref?: string } = {}
  const tags = tlv(payload)
  if (tags['54'] && Number.isFinite(Number(tags['54']))) out.amount = Number(tags['54'])
  if (tags['62']) {
    const sub = tlv(tags['62'])
    out.ref = sub['05'] ?? sub['01']
  }
  if (out.amount === undefined) {
    const m = payload.match(/(?:^|[^0-9.])([0-9]{1,7}\.[0-9]{2})(?:[^0-9]|$)/)
    if (m) out.amount = Number(m[1])
  }
  return out
}

function tlv(input: string): Record<string, string> {
  const out: Record<string, string> = {}
  let i = 0
  while (i + 4 <= input.length) {
    const tag = input.slice(i, i + 2)
    const length = Number(input.slice(i + 2, i + 4))
    if (!Number.isInteger(length)) break
    out[tag] = input.slice(i + 4, i + 4 + length)
    i += 4 + length
  }
  return out
}
