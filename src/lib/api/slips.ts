import { createServerFn } from '@tanstack/react-start'
import { readSlipImages, type SlipRead } from './slip-reader.server'
import { requireUser } from './session'

export type { SlipRead }

export const readSlips = createServerFn({ method: 'POST' })
  .validator((data: { dataUrls: string[] }) => data)
  .handler(async ({ data }): Promise<(SlipRead | null)[]> => {
    await requireUser()
    if (data.dataUrls.length === 0) return []
    try {
      return await readSlipImages(data.dataUrls)
    } catch {
      return data.dataUrls.map(() => null)
    }
  })
