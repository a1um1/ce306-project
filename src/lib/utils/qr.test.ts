import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSlipPayload } from './qr.ts'

// 54 = amount 250.00, 62 sub 05 = ref. Shininess: built by hand, not a real slip.
test('reads amount and ref from an EMVCo-shaped payload', () => {
  const payload = '0002015406250.0062110507REF0001'
  assert.deepEqual(parseSlipPayload(payload), { amount: 250, ref: 'REF0001' })
})

test('falls back to a decimal amount match', () => {
  assert.deepEqual(parseSlipPayload('KBANK SLIP TOTAL 45.50 BATH'), { amount: 45.5 })
})

test('returns empty when nothing parses', () => {
  assert.deepEqual(parseSlipPayload('garbage'), {})
})
