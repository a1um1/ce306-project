import assert from 'node:assert/strict'
import test from 'node:test'
import { RANGE_ORDER, rangeKeyFor } from './format.ts'

test('an instant right now maps to today', () => {
  assert.equal(rangeKeyFor(new Date().toISOString()), 'today')
})

test('a far-past instant falls back to the widest range', () => {
  assert.equal(rangeKeyFor('2000-01-01T00:00:00+07:00'), 'halfYear')
})

test('range order is smallest to widest', () => {
  assert.deepEqual(RANGE_ORDER, ['today', 'week', 'month', 'halfYear'])
})
