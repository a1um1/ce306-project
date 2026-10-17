import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBreakdown, calendarDays, lastMonths, monthlyTotals, weekDays } from './summary.ts'

const row = (amount: string, occurredAt: string, categoryId: string | null, name: string | null) => ({
  amount,
  occurredAt,
  categoryId,
  categoryName: name,
  categoryIcon: null,
  categoryColor: null,
})

test('breakdown groups by category, biggest first', () => {
  const slices = buildBreakdown([
    row('10.00', '2026-10-01T10:00:00+07:00', 'a', 'อาหาร'),
    row('30.00', '2026-10-02T10:00:00+07:00', 'b', 'เดินทาง'),
    row('5.00', '2026-10-03T10:00:00+07:00', 'a', 'อาหาร'),
  ])
  assert.deepEqual(
    slices.map((s) => [s.name, s.value]),
    [
      ['เดินทาง', 30],
      ['อาหาร', 15],
    ],
  )
})

test('uncategorised rows are labelled, not dropped', () => {
  const slices = buildBreakdown([row('7.00', '2026-10-01T10:00:00+07:00', null, null)])
  assert.equal(slices.length, 1)
  assert.equal(slices[0].name, 'ไม่ระบุหมวดหมู่')
})

test('monthly totals split on local month', () => {
  const totals = monthlyTotals([
    row('1.00', '2026-09-30T23:00:00+07:00', 'a', 'x'),
    row('2.00', '2026-10-01T01:00:00+07:00', 'a', 'x'),
  ])
  assert.equal(totals.get('2026-09'), 1)
  assert.equal(totals.get('2026-10'), 2)
})

test('the week starts Monday and runs seven days', () => {
  // 2026-10-17 is a Saturday.
  const days = weekDays(new Date(2026, 9, 17))
  assert.equal(days.length, 7)
  assert.equal(days[0].getDay(), 1)
  assert.equal(days[6].getDay(), 0)
  assert.equal(days[0].getDate(), 12)
})

test('the calendar grid covers the whole month with no all-outside rows', () => {
  const days = calendarDays(2026, 9)
  assert.equal(days.length % 7, 0)
  assert.equal(days[0].getDay(), 0) // starts on a Sunday
  assert.equal(days[days.length - 1].getDay(), 6) // ends on a Saturday
  assert.ok(days.some((d) => d.getMonth() === 9 && d.getDate() === 31))
  // every week row contains at least one day of the month
  for (let i = 0; i < days.length; i += 7) {
    assert.ok(days.slice(i, i + 7).some((d) => d.getMonth() === 9))
  }
})

test('last six months end on the current month', () => {
  const months = lastMonths(new Date(2026, 9, 17), 6)
  assert.equal(months.length, 6)
  assert.equal(months[0].getMonth(), 4)
  assert.equal(months[5].getMonth(), 9)
  assert.equal(months[0].getDate(), 1)
})
