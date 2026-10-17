import assert from 'node:assert/strict'
import test from 'node:test'
import { nameScore, normalizeText, suggestCategoryId } from './categorize.ts'

const CATEGORIES = [
  { id: 'food', name: 'อาหาร' },
  { id: 'transport', name: 'เดินทาง' },
  { id: 'shopping', name: 'ช้อปปิ้ง' },
  { id: 'school', name: 'ค่าเล่าเรียน' },
  { id: 'other', name: 'อื่น ๆ' },
]

test('tone marks and spacing are dropped', () => {
  assert.equal(normalizeText('ช้อปปิ้ง'), 'ชอปปง')
  assert.equal(normalizeText('7-11'), '711')
})

test('a category name inside the slip text wins', () => {
  assert.equal(suggestCategoryId('ค่าอาหารกลางวัน', CATEGORIES, []), 'food')
  assert.equal(suggestCategoryId('ช้อปปิ้งออนไลน์ Shopee', CATEGORIES, []), 'shopping')
  assert.equal(suggestCategoryId('ค่าเดินทางไปทำงาน', CATEGORIES, []), 'transport')
})

test('a shared prefix alone does not match', () => {
  assert.equal(suggestCategoryId('ค่าเทอมมหาวิทยาลัย', CATEGORIES, []), null)
  assert.equal(suggestCategoryId('โอนเงินให้แม่', CATEGORIES, []), null)
  assert.equal(suggestCategoryId('7-11', CATEGORIES, []), null)
})

test('a name that merely shares a run of letters does not match', () => {
  // "…นทา…" occurs in both this payee and เดินทาง.
  assert.equal(suggestCategoryId('นาย สุรัตน์ ทาราช', CATEGORIES, []), null)
  assert.equal(suggestCategoryId('บ้านปั่นผ้า นาย ยศวัต วณิชศิริกุล', CATEGORIES, []), null)
})

test('a merchant paid before reuses its category', () => {
  const history = [{ text: 'THE PIZZA COMPANY THEPIZZACOMPANY', categoryId: 'food' }]
  // No category name resembles it, so only history can resolve it.
  assert.equal(nameScore(normalizeText('THE PIZZA COMPANY'), normalizeText('อาหาร')), 0)
  assert.equal(suggestCategoryId('THE PIZZA COMPANY THEPIZZACOMPANY', CATEGORIES, history), 'food')
})

test('history outranks a category-name match', () => {
  const history = [{ text: 'ช้อปปิ้งออนไลน์ Shopee', categoryId: 'other' }]
  assert.equal(suggestCategoryId('ช้อปปิ้งออนไลน์ Shopee', CATEGORIES, history), 'other')
})

test('blank text suggests nothing', () => {
  assert.equal(suggestCategoryId('', CATEGORIES, []), null)
})
