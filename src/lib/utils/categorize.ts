export type CategoryOption = { id: string; name: string }
export type CategoryHistory = { text: string; categoryId: string }

const MIN_MATCH = 3
const MATCH_COVERAGE = 0.5
const HISTORY_MIN = 4

// Thai tone marks are separate code points and only add noise to matching.
export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function longestPrefixInText(categoryName: string, text: string, min: number): number {
  for (let length = categoryName.length; length >= min; length--) {
    if (text.includes(categoryName.slice(0, length))) return length
  }
  return 0
}

// How much of the category name shows up inside the slip text. The match must
// start at the name's first character: Thai names share stray runs like "นทา",
// so a match anywhere ("นายสุรัตนทาราช" vs "เดินทาง") would be a false positive.
export function nameScore(text: string, categoryName: string): number {
  if (categoryName.length < MIN_MATCH) return 0
  const matched = longestPrefixInText(categoryName, text, MIN_MATCH)
  if (matched === 0) return 0
  const score = matched / categoryName.length
  return score >= MATCH_COVERAGE ? score : 0
}

export function suggestCategoryId(
  text: string,
  categories: CategoryOption[],
  history: CategoryHistory[],
): string | null {
  const needle = normalizeText(text)
  if (needle.length < MIN_MATCH) return null

  let best: { score: number; id: string } | null = null

  // A merchant seen before wins: that is the category the user actually chose.
  // `history` is ordered newest first, so ties keep the most recent choice.
  for (const entry of history) {
    const key = normalizeText(entry.text)
    if (key.length < HISTORY_MIN) continue
    let score = 0
    if (key === needle) score = 1
    else if (needle.length >= HISTORY_MIN && needle.includes(key)) score = 0.9
    else if (needle.length >= HISTORY_MIN && key.includes(needle)) score = 0.8
    if (score > 0 && (!best || score > best.score)) best = { score, id: entry.categoryId }
  }
  if (best) return best.id

  for (const category of categories) {
    const score = nameScore(needle, normalizeText(category.name))
    if (score > (best?.score ?? 0)) best = { score, id: category.id }
  }

  return best?.id ?? null
}
