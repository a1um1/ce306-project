import assert from 'node:assert/strict'
import test from 'node:test'
import { RANGE_ORDER, formatAmount, rangeKeyFor } from './format.ts'

test('amounts get thousands separators', () => {
  assert.equal(formatAmount('1234.50'), '1,234.50')
  assert.equal(formatAmount(1234567), '1,234,567')
  assert.equal(formatAmount('34.00'), '34')
  assert.equal(formatAmount('not a number'), '0')
})

test('an instant right now maps to today', () => {
  assert.equal(rangeKeyFor(new Date().toISOString()), 'today')
})

test('a far-past instant falls back to the widest range', () => {
  assert.equal(rangeKeyFor('2000-01-01T00:00:00+07:00'), 'halfYear')
})

test('range order is smallest to widest', () => {
  assert.deepEqual(RANGE_ORDER, ['today', 'week', 'month', 'halfYear', 'year'])
})
