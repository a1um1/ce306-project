import assert from 'node:assert/strict'
import test from 'node:test'
import { merchantCore, normalizeText, suggestCategoryId, type MerchantRule } from './categorize.ts'

const rule = (text: string, categoryId: string): MerchantRule => ({
  key: merchantCore(text),
  categoryId,
})

test('tone marks and spacing are dropped', () => {
  assert.equal(normalizeText('ช้อปปิ้ง'), 'ชอปปง')
  assert.equal(normalizeText('7-11'), '711')
})

test('a merchant core absorbs honorifics, company words and ref codes', () => {
  const cores = [
    'TrueMoney Wallet',
    'TrueMoney',
    'TRUE MONEY COMPANY LIMITED a723ebcc6dee4b9b8ae6',
    'TRUE MONEY COMPANY LIMITED',
  ].map(merchantCore)
  assert.equal(new Set(cores).size, 1)
  assert.equal(cores[0], 'truemoney')

  // A slip ref code and honorific must not change the core.
  assert.equal(merchantCore('น.ส. พคพร ช่วยชูตระกูล'), merchantCore('นางสาว พคพร ช่วยชูตระกูล'))
})

test('a known merchant core maps to its category', () => {
  const rules = [
    rule('TrueMoney Wallet', 'other'),
    rule('GrabPay Wallet', 'other'),
    rule('ร้านเวนดิ้งบายบุญเติม บมจ. ฟอร์ท สมาร์ท เซอร์วิส', 'other'),
  ]
  assert.equal(
    suggestCategoryId('TRUE MONEY COMPANY LIMITED dc83bba8bfe64773be65', rules),
    'other',
  )
  assert.equal(suggestCategoryId('GrabPay Wallet', rules), 'other')
  assert.equal(suggestCategoryId('ร้านเวนดิ้งบายบุญเติม บมจ. ฟอร์ท สมาร์ท เซอร์วิส', rules), 'other')
})

test('an unseen merchant is left uncategorised instead of guessed', () => {
  const rules = [rule('GrabPay Wallet', 'other')]
  assert.equal(suggestCategoryId('นาย สุรัตน์ ทาราช', rules), null)
  assert.equal(suggestCategoryId('น.ส. พคพร ช่วยชูตระกูล', rules), null)
  // "เนตร" must not match a "เน็ต" rule: matching is whole-core, not substring.
  assert.equal(suggestCategoryId('นางสาว ประภัสสร เนตรทอง', [rule('เน็ต', 'phone')]), null)
})

test("the user's rule overrides a seed for the same merchant", () => {
  const rules = [rule('GrabPay Wallet', 'other'), rule('GrabPay Wallet', 'transport')]
  assert.equal(suggestCategoryId('GrabPay Wallet', rules), 'transport')
})

test('blank text suggests nothing', () => {
  assert.equal(suggestCategoryId('', []), null)
})
