// Files behind the labeling tool: the slip images in tools/slip-reader/data and
// the annotations in tools/slip-reader/training/labels.jsonl (one JSON per line,
// keyed by the image path). Written so the JSONL can be fed to a trainer as-is.
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const TOOL_DIR = fileURLToPath(new URL('../../tools/slip-reader', import.meta.url))

export const DATA_DIR = join(TOOL_DIR, 'data')
export const LABELS_FILE = join(TOOL_DIR, 'training', 'labels.jsonl')

const IMAGE_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

export function imageMime(path: string): string | null {
  return IMAGE_EXT[extname(path).toLowerCase()] ?? null
}

export type SlipFile = { path: string; name: string; bank: string }

// Strings, so an annotator can leave a field blank. Parse `amount` when training.
export type SlipLabel = {
  amount: string
  dateTime: string
  transactionId: string
  sender: string
  recipient: string
}

export type LabelRecord = {
  path: string
  ocrText: string
  predicted: SlipLabel
  // Absent until a human confirms the read in /label.
  label?: SlipLabel
  updatedAt: string
}

async function walk(dir: string, prefix: string): Promise<SlipFile[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const files: SlipFile[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...(await walk(join(dir, entry.name), path)))
    else if (imageMime(entry.name)) {
      files.push({ path, name: entry.name, bank: prefix.split('/')[0] || 'other' })
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

export function listSlipFiles(): Promise<SlipFile[]> {
  return walk(DATA_DIR, '')
}

// Null when the path escapes the data directory or is not an image.
export function resolveSlip(path: string): { abs: string; mime: string } | null {
  const mime = imageMime(path)
  if (!mime) return null
  const abs = resolve(DATA_DIR, path)
  if (!abs.startsWith(DATA_DIR + sep)) return null
  return existsSync(abs) ? { abs, mime } : null
}

export async function loadLabels(file = LABELS_FILE): Promise<Map<string, LabelRecord>> {
  const records = new Map<string, LabelRecord>()
  let text = ''
  try {
    text = await readFile(file, 'utf8')
  } catch {
    return records
  }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const record = JSON.parse(line) as LabelRecord
      if (record.path && record.predicted) records.set(record.path, record)
    } catch {
      // A hand-edited bad line should not hide the rest of the file.
    }
  }
  return records
}

export async function saveLabels(records: LabelRecord[], file = LABELS_FILE): Promise<number> {
  const merged = await loadLabels(file)
  for (const record of records) {
    // A later prediction-only write must not destroy a human label.
    const confirmed = merged.get(record.path)?.label
    merged.set(record.path, confirmed && !record.label ? { ...record, label: confirmed } : record)
  }
  const lines = [...merged.values()]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((record) => JSON.stringify(record))
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, lines.length ? `${lines.join('\n')}\n` : '')
  return records.length
}

// A read the import worker already accepted: keep the image in the corpus. The
// import stored these values unchanged, so nothing was corrected by hand and
// the read counts as a correct training label.
// shortcut: the import gate only checks amount + reference, so a wrong date or
// name can still be recorded as a label. Fix it in /label if eval shows drift.
// shortcut: concurrent imports can overwrite each other's JSONL append; imports
// run one job at a time in practice. Serialize if that changes.
export async function saveImportRead(
  image: Uint8Array,
  name: string,
  read: { ocrText: string; predicted: SlipLabel },
): Promise<void> {
  const dir = join(DATA_DIR, 'imports')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, name), image)
  await saveLabels([
    {
      path: `imports/${name}`,
      ocrText: read.ocrText,
      predicted: read.predicted,
      label: read.predicted,
      updatedAt: new Date().toISOString(),
    },
  ])
}
