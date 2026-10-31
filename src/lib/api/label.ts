import { apiFetch, apiUrl } from './client'

export type SlipLabel = {
  amount: string
  dateTime: string
  transactionId: string
  sender: string
  recipient: string
}

export type LabelRecord = {
  path: string
  ocrText: string
  predicted: SlipLabel
  // Absent until a human confirms the read in /label.
  label?: SlipLabel
  updatedAt: string
}

export type LabelFile = {
  path: string
  name: string
  bank: string
  record: LabelRecord | null
}

export type RunResult = {
  path: string
  ok: boolean
  ocrText: string
  predicted: SlipLabel | null
}

export function listSlips(): Promise<{ files: LabelFile[]; labelsFile: string }> {
  return apiFetch('/api/label/slips')
}

export function runSlips(paths: string[]): Promise<{ results: RunResult[] }> {
  return apiFetch('/api/label/run', { method: 'POST', body: JSON.stringify({ paths }) })
}

export function saveLabelRecords(
  records: { path: string; ocrText: string; predicted: SlipLabel | null; label: SlipLabel }[],
): Promise<{ saved: number }> {
  return apiFetch('/api/label/save', { method: 'POST', body: JSON.stringify({ records }) })
}

export function uploadSlips(files: File[]): Promise<{ files: LabelFile[] }> {
  const body = new FormData()
  for (const file of files) body.append('files', file)
  return apiFetch('/api/label/upload', { method: 'POST', body })
}

export function slipImageUrl(path: string): string {
  return apiUrl(`/api/label/image?path=${encodeURIComponent(path)}`)
}
