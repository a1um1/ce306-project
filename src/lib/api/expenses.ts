import { apiFetch } from './client'
import type { Expense, ExpenseFilter, ExpenseInput, ExpenseRow, ExpenseUpdate } from './types'

export type { Expense, ExpenseFilter, ExpenseInput, ExpenseRow, ExpenseUpdate } from './types'

function toQuery(filter: ExpenseFilter): string {
  const params = new URLSearchParams()
  if (filter.from) params.set('from', filter.from)
  if (filter.to) params.set('to', filter.to)
  if (filter.categoryId) params.set('categoryId', filter.categoryId)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function listExpenses(filter: ExpenseFilter = {}): Promise<ExpenseRow[]> {
  return apiFetch<ExpenseRow[]>(`/api/expenses${toQuery(filter)}`)
}

export function listImportedExternalIds(): Promise<string[]> {
  return apiFetch<string[]>('/api/expenses/external-ids')
}

export function createExpense(input: ExpenseInput): Promise<Expense> {
  return apiFetch<Expense>('/api/expenses', { method: 'POST', body: JSON.stringify(input) })
}

export function importExpenses(
  items: ExpenseInput[],
): Promise<{ inserted: number; skipped: number }> {
  return apiFetch('/api/expenses/import', { method: 'POST', body: JSON.stringify({ items }) })
}

export function updateExpense(id: string, input: ExpenseUpdate): Promise<Expense | null> {
  return apiFetch<Expense | null>(`/api/expenses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteExpense(id: string): Promise<{ ok: true }> {
  return apiFetch(`/api/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
