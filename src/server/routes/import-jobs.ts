import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '@/db'
import { importJob } from '@/db/schema'
import type { ImportJobView, UploadImage } from '@/lib/api/types'
import { requireUser } from '../auth-context'
import { processImportJob, resumeImportJobs, writeJobFiles } from '../import-worker'

export const importJobRoutes = new Hono()

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
importJobRoutes.post('/', async (c) => {
  const user = await requireUser(c)
  const { images } = await c.req.json<{ images: UploadImage[] }>()
  const uploads = images.filter((image) => image.data)
  if (uploads.length === 0) return c.json({ id: null })

  const id = crypto.randomUUID()
  await writeJobFiles(id, uploads)
  await db.insert(importJob).values({ id, userId: user.id, status: 'pending', total: uploads.length })
  void processImportJob(id)
  return c.json({ id })
})

importJobRoutes.get('/:id', async (c) => {
  const user = await requireUser(c)
  const [row] = await db
    .select()
    .from(importJob)
    .where(and(eq(importJob.id, c.req.param('id')), eq(importJob.userId, user.id)))
  if (!row) return c.json(null)
  if (row.status === 'pending' || row.status === 'processing') void resumeImportJobs()
  return c.json(toView(row))
})
