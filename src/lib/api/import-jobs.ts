import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { importJob } from '@/db/schema'
import { processImportJob, resumeImportJobs, writeJobFiles, type UploadImage } from './import-worker.server'
import { requireUser } from './session'

export type ImportJobView = {
  id: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  total: number
  processed: number
  imported: number
  skipped: number
  failed: number
  earliestAt: string | null
  error: string | null
}

function toView(row: typeof importJob.$inferSelect): ImportJobView {
  return {
    id: row.id,
    status: row.status as ImportJobView['status'],
    total: row.total,
    processed: row.processed,
    imported: row.imported,
    skipped: row.skipped,
    failed: row.failed,
    earliestAt: row.earliestAt?.toISOString() ?? null,
    error: row.error,
  }
}

// Hand the batch to the server and return at once: OCR + import run in the
// background, so the dialog can close (and the tab can too).
export const createImportJob = createServerFn({ method: 'POST' })
  .validator((data: { images: UploadImage[] }) => data)
  .handler(async ({ data }): Promise<{ id: string | null }> => {
    const user = await requireUser()
    const images = data.images.filter((image) => image.data)
    if (images.length === 0) return { id: null }

    const id = crypto.randomUUID()
    await writeJobFiles(id, images)
    await db.insert(importJob).values({ id, userId: user.id, status: 'pending', total: images.length })
    void processImportJob(id)
    return { id }
  })

export const getImportJob = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<ImportJobView | null> => {
    const user = await requireUser()
    const [row] = await db
      .select()
      .from(importJob)
      .where(and(eq(importJob.id, data.id), eq(importJob.userId, user.id)))
    if (!row) return null
    if (row.status === 'pending' || row.status === 'processing') void resumeImportJobs()
    return toView(row)
  })
