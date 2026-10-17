import { decodeQrFile } from '@/lib/utils/qr'

export type UploadImage = { data: string; name: string; payload: string | null }

// Vision OCR downscales anyway; 1800px keeps the slip legible without shipping
// huge originals.
const MAX_DIM = 1800

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

// One JPEG per file for the server's OCR, plus a QR payload decoded here (the
// server never sees the original file) so a QR-only image still imports.
export async function prepareUploads(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<UploadImage[]> {
  const images = files.filter((file) => file.type.startsWith('image/'))
  const out: UploadImage[] = []

  for (let index = 0; index < images.length; index++) {
    const file = images[index]
    let data = ''
    try {
      const bitmap = await createImageBitmap(file)
      data = await encode(bitmap, MAX_DIM, 0.85)
      bitmap.close()
    } catch {
      // Leave data empty; the server counts it as unreadable.
    }
    const payload = await decodeQrFile(file).catch(() => null)
    out.push({ data, name: file.name, payload })
    onProgress?.(index + 1, images.length)
  }

  return out
}
