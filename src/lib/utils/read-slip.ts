import { readSlips, type SlipRead } from '@/lib/api/slips'
import { decodeQrFile, parseSlipPayload } from '@/lib/utils/qr'

export type SlipReading = {
  thumb: string
  title: string
  amount: string
  dateTime: string | null
  payload: string | null
  externalId: string | null
  via: 'ocr' | 'qr' | 'none'
}

// Vision OCR handles the whole slip, so send a few at a time: one process per
// request and still per-chunk progress in the UI.
const CHUNK = 4
const MAX_DIM = 1800

type Prepared = { full: string; thumb: string } | null

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

async function encode(bitmap: ImageBitmap, max: number, quality: number): Promise<string> {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(bitmap, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

async function prepare(file: File): Promise<Prepared> {
  try {
    const bitmap = await createImageBitmap(file)
    const [full, thumb] = await Promise.all([encode(bitmap, MAX_DIM, 0.85), encode(bitmap, 160, 0.7)])
    bitmap.close()
    return { full, thumb }
  } catch {
    return null
  }
}

async function qrFallback(file: File): Promise<SlipReading | null> {
  try {
    const payload = await decodeQrFile(file)
    if (!payload) return null
    const parsed = parseSlipPayload(payload)
    if (!parsed.amount) return null
    const ref = parsed.ref ?? null
    return {
      thumb: '',
      title: ref ?? baseName(file.name),
      amount: String(parsed.amount),
      dateTime: null,
      payload,
      // "qr:" prefix keeps QR refs from colliding with slip transaction ids.
      externalId: ref ? `qr:${ref}` : null,
      via: 'qr',
    }
  } catch {
    return null
  }
}

export async function readSlipFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<SlipReading[]> {
  const out: SlipReading[] = []

  for (let start = 0; start < files.length; start += CHUNK) {
    const chunk = files.slice(start, start + CHUNK)
    const prepared = await Promise.all(chunk.map(prepare))

    let reads: (SlipRead | null)[] = prepared.map(() => null)
    const dataUrls = prepared.map((item) => item?.full ?? '')
    if (dataUrls.some(Boolean)) {
      try {
        reads = await readSlips({ data: { dataUrls } })
      } catch {
        reads = prepared.map(() => null)
      }
    }

    for (let i = 0; i < chunk.length; i++) {
      const file = chunk[i]
      const thumb = prepared[i]?.thumb ?? ''
      const ocr = reads[i]

      if (ocr && ocr.amount > 0) {
        out.push({
          thumb,
          title: ocr.recipient || ocr.title || ocr.transactionId || baseName(file.name),
          amount: String(ocr.amount),
          dateTime: ocr.dateTime,
          payload: null,
          externalId: ocr.transactionId || null,
          via: 'ocr',
        })
        continue
      }

      const qr = await qrFallback(file)
      if (qr) {
        out.push({ ...qr, thumb })
        continue
      }

      out.push({
        thumb,
        title: baseName(file.name),
        amount: '',
        dateTime: null,
        payload: null,
        externalId: null,
        via: 'none',
      })
    }

    onProgress?.(Math.min(start + CHUNK, files.length), files.length)
  }

  return out
}
