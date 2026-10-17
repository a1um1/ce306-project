export const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

export function formatAmount(amount: number | string): string {
  const n = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export function formatThaiDate(iso: string | Date, withTime = true): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const date = `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)}`
  if (!withTime) return date
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${date} ${hh}:${mm}`
}

// Time only — the day lives in the list's date header.
export function formatTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// "วันนี้" / "เมื่อวาน" / "17 ต.ค. 69" for a YYYY-MM-DD key.
export function dayLabel(dateKey: string): string {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateKey === toDateKey(today)) return 'วันนี้'
  if (dateKey === toDateKey(yesterday)) return 'เมื่อวาน'
  const [y, m, d] = dateKey.split('-').map(Number)
  return `${d} ${THAI_MONTHS[m - 1]} ${String(y + 543).slice(-2)}`
}

// Local-time date keys (YYYY-MM-DD) so range filters line up with what the user sees.
export function toDateKey(d: Date): string {  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export type RangeKey = 'today' | 'week' | 'month' | 'halfYear' | 'year'

export const RANGE_ORDER: RangeKey[] = ['today', 'week', 'month', 'halfYear', 'year']

export const RANGE_LABEL: Record<RangeKey, string> = {
  today: 'วันนี้',
  week: 'สัปดาห์นี้',
  month: 'เดือนนี้',
  halfYear: '6 เดือนย้อนหลัง',
  year: 'ทั้งปี',
}

export function rangeBounds(
  key: RangeKey,
  year = new Date().getFullYear(),
): { from: string; to: string } {
  const now = new Date()
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  let start: Date
  switch (key) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'week': {
      // Thai week starts Monday.
      const dow = now.getDay() === 0 ? 6 : now.getDay() - 1
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow)
      break
    }
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'halfYear':
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      break
    case 'year':
      start = new Date(year, 0, 1)
      end = new Date(year, 11, 31, 23, 59, 59)
      break
  }
  return { from: start.toISOString(), to: end.toISOString() }
}

// Date input value (YYYY-MM-DD) -> local day bounds as ISO instants.
export function dayStartIso(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0).toISOString()
}

export function dayEndIso(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59).toISOString()
}

export function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

// Smallest range that still contains the given instant, so an imported slip
// dated in the past stays visible instead of falling outside "today".
export function rangeKeyFor(iso: string): RangeKey {
  const time = new Date(iso).getTime()
  for (const key of RANGE_ORDER) {
    if (key === 'halfYear') return key
    if (time >= new Date(rangeBounds(key).from).getTime()) return key
  }
  return 'halfYear'
}

