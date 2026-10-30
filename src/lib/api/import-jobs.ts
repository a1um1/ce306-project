import { apiFetch } from './client'
import type { ImportJobView, UploadImage } from './types'

export type { ImportJobView, UploadImage } from './types'

// The server hands the batch to a background job and returns at once.
export function createImportJob(images: UploadImage[]): Promise<{ id: string | null }> {
  return apiFetch('/api/import-jobs', { method: 'POST', body: JSON.stringify({ images }) })
}

export function getImportJob(id: string): Promise<ImportJobView | null> {
  return apiFetch<ImportJobView | null>(`/api/import-jobs/${encodeURIComponent(id)}`)
}
