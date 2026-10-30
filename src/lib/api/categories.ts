import { apiFetch } from './client'
import type { Category, CategoryInput } from './types'

export type { Category, CategoryInput } from './types'

export function listCategories(): Promise<Category[]> {
  return apiFetch<Category[]>('/api/categories')
}

// Auto-categoriser: one suggestion (or null) per text, by merchant memory.
export function suggestCategories(texts: string[]): Promise<(string | null)[]> {
  return apiFetch<(string | null)[]>('/api/categories/suggest', {
    method: 'POST',
    body: JSON.stringify({ texts }),
  })
}

export function createCategory(input: CategoryInput): Promise<Category> {
  return apiFetch<Category>('/api/categories', { method: 'POST', body: JSON.stringify(input) })
}

export function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  return apiFetch<Category>(`/api/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
