import { toDateKey } from './format.ts'

export type SummaryRow = {
  amount: string | number
  occurredAt: string | Date
  categoryId: string | null
  categoryName: string | null
  categoryIcon: string | null
  categoryColor: string | null
}

export type BreakdownSlice = {
  key: string
  name: string
  icon: string | null
  color: string | null
  value: number
}

export type Bucket = { label: string; value: number }

export function buildBreakdown(rows: SummaryRow[]): BreakdownSlice[] {
  const byKey = new Map<string, BreakdownSlice>()
  for (const row of rows) {
    const key = row.categoryId ?? 'none'
    const slice = byKey.get(key) ?? {
      key,
      name: row.categoryName ?? 'ไม่ระบุหมวดหมู่',
      icon: row.categoryIcon,
      color: row.categoryColor,
      value: 0,
    }
    slice.value += Number(row.amount) || 0
    byKey.set(key, slice)
  }
  return [...byKey.values()].sort((a, b) => b.value - a.value)
}

export function dailyTotals(rows: SummaryRow[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const key = toDateKey(new Date(row.occurredAt))
    totals.set(key, (totals.get(key) ?? 0) + (Number(row.amount) || 0))
  }
  return totals
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthlyTotals(rows: SummaryRow[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const key = monthKey(new Date(row.occurredAt))
    totals.set(key, (totals.get(key) ?? 0) + (Number(row.amount) || 0))
  }
  return totals
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

// Monday..Sunday of the week containing `date`, matching rangeBounds('week').
export function weekDays(date: Date): Date[] {
  const dow = date.getDay() === 0 ? 6 : date.getDay() - 1
  const monday = addDays(startOfDay(date), -dow)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

// 6 weeks x 7 days from the Sunday on/before the 1st, so the whole month fits.
export function calendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const start = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

// First day of each of the last `count` months, oldest first.
export function lastMonths(date: Date, count: number): Date[] {
  return Array.from(
    { length: count },
    (_, i) => new Date(date.getFullYear(), date.getMonth() - (count - 1 - i), 1),
  )
}
