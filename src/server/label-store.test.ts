import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { loadLabels, resolveSlip, saveLabels, type SlipLabel } from './label-store.ts'

const label: SlipLabel = {
  amount: '198',
  dateTime: '2026-09-10T09:24:00',
  transactionId: '016253092413CPM01291',
  sender: 'นาย ก',
  recipient: 'THE PIZZA COMPANY',
}

test('saveLabels upserts by path instead of appending duplicates', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'paytail-labels-'))
  const file = join(dir, 'labels.jsonl')
  try {
    const record = { path: 'kbank/a.jpg', ocrText: 'one', predicted: label, label, updatedAt: 't1' }
    await saveLabels([record], file)
    await saveLabels([{ ...record, ocrText: 'two', updatedAt: 't2' }], file)

    const saved = await loadLabels(file)
    assert.equal(saved.size, 1)
    assert.equal(saved.get('kbank/a.jpg')?.ocrText, 'two')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('an unconfirmed prediction is kept, and a later one does not drop the label', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'paytail-labels-'))
  const file = join(dir, 'labels.jsonl')
  try {
    const path = 'imports/job-0.jpg'
    await saveLabels([{ path, ocrText: 'x', predicted: label, updatedAt: 't1' }], file)
    assert.equal((await loadLabels(file)).get(path)?.label, undefined)

    await saveLabels([{ path, ocrText: 'x', predicted: label, label, updatedAt: 't2' }], file)
    await saveLabels([{ path, ocrText: 'y', predicted: label, updatedAt: 't3' }], file)

    const saved = (await loadLabels(file)).get(path)
    assert.equal(saved?.ocrText, 'y')
    assert.deepEqual(saved?.label, label)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('resolveSlip refuses paths outside the data directory', () => {
  assert.equal(resolveSlip('../reader.ts'), null)
  assert.equal(resolveSlip('kbank/../../reader.jpg'), null)
  assert.equal(resolveSlip('/tmp/outside.jpg'), null)
  assert.equal(resolveSlip('kbank/slip.txt'), null)
})
