import { and, eq, isNotNull, lt, or } from 'drizzle-orm'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { db } from '@/db'
import { expense, importJob } from '@/db/schema'
import { suggestCategoryId } from '@/lib/utils/categorize'
import { parseSlipPayload } from '@/lib/utils/qr'
import { loadMerchantRules } from './merchant-rules'
import { readSlipImages, type SlipRead } from './slip-reader.server'

// Vision OCR handles the whole slip, so send a few at a time: one process per
// chunk, and progress after each chunk.
const CHUNK = 12
// A job untouched this long was orphaned by a server restart, so it is safe to
// pick back up. Live jobs refresh updatedAt every chunk.
const STALE_MS = 90_000

export type UploadImage = { data: string; name: string; payload: string | null }
type Meta = { name: string; payload: string | null }

const ROOT = join(process.cwd(), '.data', 'imports')

function jobDir(jobId: string): string {
  return join(ROOT, jobId)
}

// Persist the batch before responding so a crash mid-job can be resumed.
export async function writeJobFiles(jobId: string, images: UploadImage[]): Promise<void> {
  const dir = jobDir(jobId)
  await mkdir(dir, { recursive: true })
  const meta: Meta[] = []
  for (const [index, image] of images.entries()) {
    const base64 = image.data.split(',')[1] ?? ''
    await writeFile(join(dir, `${index}.img`), Buffer.from(base64, 'base64'))
    meta.push({ name: image.name, payload: image.payload })
  }
  await writeFile(join(dir, 'meta.json'), JSON.stringify(meta))
}

async function readChunk(jobId: string, start: number, count: number): Promise<string[]> {
  const dir = jobDir(jobId)
  const urls: string[] = []
  for (let index = start; index < start + count; index++) {
    const bytes = await readFile(join(dir, `${index}.img`))
    urls.push(`data:image/jpeg;base64,${bytes.toString('base64')}`)
  }
  return urls
}

// One job per id at a time: the in-memory set stops a resume and a live run
// from double-processing.
const running = new Set<string>()

export async function processImportJob(jobId: string): Promise<void> {
  if (running.has(jobId)) return
  running.add(jobId)
  try {
    const [job] = await db.select().from(importJob).where(eq(importJob.id, jobId))
    if (!job || job.status === 'done') return
    await db
      .update(importJob)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(importJob.id, jobId))

    const meta = JSON.parse(await readFile(join(jobDir(jobId), 'meta.json'), 'utf8')) as Meta[]
    const incoming: {
      title: string
      amount: number
      occurredAt: string
      externalId: string | null
      payload: string | null
    }[] = []
    let failed = 0

    for (let start = 0; start < meta.length; start += CHUNK) {
      const slice = meta.slice(start, start + CHUNK)
      const dataUrls = await readChunk(jobId, start, slice.length)
      let reads: (SlipRead | null)[]
      try {
        reads = await readSlipImages(dataUrls)
      } catch {
        reads = dataUrls.map(() => null)
      }

      for (let i = 0; i < slice.length; i++) {
        const ocr = reads[i]
        // A slip files safely only with both an amount and a reference. Without
        // them it is a bad read: count it failed instead of importing a guess.
        if (ocr && ocr.amount > 0 && ocr.transactionId) {
          incoming.push({
            title: ocr.recipient || ocr.title || ocr.transactionId,
            amount: ocr.amount,
            occurredAt: ocr.dateTime ?? new Date().toISOString(),
            externalId: ocr.transactionId,
            payload: null,
          })
          continue
        }
        // QR fallback, decoded client-side and carried along since the server
        // cannot read the original file.
        const qr = slice[i].payload ? parseSlipPayload(slice[i].payload!) : null
        if (qr?.amount && qr.ref) {
          incoming.push({
            title: qr.ref,
            amount: qr.amount,
            occurredAt: new Date().toISOString(),
            // "qr:" prefix keeps QR refs from colliding with slip transaction ids.
            externalId: `qr:${qr.ref}`,
            payload: slice[i].payload,
          })
          continue
        }
        failed += 1
      }

      await db
        .update(importJob)
        .set({ processed: Math.min(start + CHUNK, meta.length), updatedAt: new Date() })
        .where(eq(importJob.id, jobId))
    }

    const rules = await loadMerchantRules(job.userId)
    const known = await db
      .select({ externalId: expense.externalId })
      .from(expense)
      .where(and(eq(expense.userId, job.userId), isNotNull(expense.externalId)))
    const seen = new Set(known.map((row) => row.externalId))

    const rows: (typeof expense.$inferInsert)[] = []
    let skipped = 0
    let earliest = Number.POSITIVE_INFINITY
    for (const item of incoming) {
      // Anything already stored, plus repeats inside this batch, is a duplicate.
      if (item.externalId) {
        if (seen.has(item.externalId)) {
          skipped += 1
          continue
        }
        seen.add(item.externalId)
      }
      const occurredAt = new Date(item.occurredAt)
      earliest = Math.min(earliest, occurredAt.getTime())
      rows.push({
        id: crypto.randomUUID(),
        userId: job.userId,
        categoryId: suggestCategoryId(item.title, rules),
        title: item.title,
        payee: null,
        amount: item.amount.toFixed(2),
        occurredAt,
        source: 'qr',
        qrPayload: item.payload,
        externalId: item.externalId,
      })
    }

    let imported = 0
    if (rows.length > 0) {
      const inserted = await db
        .insert(expense)
        .values(rows)
        // Unique on (user_id, external_id): re-importing a slip is a no-op.
        .onConflictDoNothing({ target: [expense.userId, expense.externalId] })
        .returning({ id: expense.id })
      imported = inserted.length
    }

    await db
      .update(importJob)
      .set({
        status: 'done',
        processed: meta.length,
        imported,
        skipped,
        failed,
        earliestAt: Number.isFinite(earliest) ? new Date(earliest) : null,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(importJob.id, jobId))
  } catch (cause) {
    await db
      .update(importJob)
      .set({
        status: 'failed',
        error: cause instanceof Error ? cause.message : String(cause),
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(importJob.id, jobId))
      .catch(() => {})
  } finally {
    running.delete(jobId)
    // Done or failed: the bytes are no longer needed. A crash skips this, which
    // is exactly what leaves files behind for the resume above.
    await rm(jobDir(jobId), { recursive: true, force: true }).catch(() => {})
  }
}

// Self-healing: called on job reads. Picks up jobs the server never finished
// (pending, or processing but gone quiet).
export async function resumeImportJobs(): Promise<void> {
  const stale = new Date(Date.now() - STALE_MS)
  const jobs = await db
    .select({ id: importJob.id })
    .from(importJob)
    .where(
      or(eq(importJob.status, 'pending'), and(eq(importJob.status, 'processing'), lt(importJob.updatedAt, stale))),
    )
  for (const job of jobs) {
    if (!running.has(job.id)) void processImportJob(job.id)
  }
}
