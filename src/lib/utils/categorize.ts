export type MerchantRule = { key: string; categoryId: string }

// Thai tone marks are separate code points and only add noise to matching.
export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

// Bank boilerplate that says nothing about what was bought.
const NOISE = /(บจก|บมจ|จำกัด|จากัด|companylimited|publiccompanylimited|coltd|wallet|qrpaymentat|qrpayment|qrpurchase|paymentto)/g

// Stable identity of a merchant: "TrueMoney Wallet", "TRUE MONEY COMPANY
// LIMITED <ref>" and "TrueMoney" all collapse to "truemoney". The bank appends
// honorifics, company suffixes and hex/digit reference codes that vary per
// slip, so they are stripped here and never stored.
export function merchantCore(text: string): string {
  return normalizeText(text)
    .replace(/^(นาย|นางสาว|นาง|นส|คุณ)/, '')
    .replace(NOISE, '')
    .replace(/[0-9a-f]{8,}/g, '')
    .replace(/\d+/g, '')
}

// Auto-categoriser: exact merchant memory only. A slip is labelled when its
// merchant core was seen before (a seed brand, or a merchant the user already
// categorised). Anything unseen stays uncategorised — no guessing, so the
// keyword-substring false positives ("เนตร" as "เน็ต") cannot happen.
// `rules` is ordered seed-first, user-last: the user's choice wins.
export function suggestCategoryId(text: string, rules: MerchantRule[]): string | null {
  const core = merchantCore(text)
  if (!core) return null

  let found: string | null = null
  for (const rule of rules) {
    if (merchantCore(rule.key) === core) found = rule.categoryId
  }
  return found
}
