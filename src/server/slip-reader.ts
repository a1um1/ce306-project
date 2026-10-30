import { execFile, execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export type SlipRead = {
  amount: number
  dateTime: string | null
  transactionId: string
  title: string
  recipient: string
}

const TOOL_DIR = join(process.cwd(), 'tools', 'slip-reader')
const BIN = join(TOOL_DIR, 'bin', 'slipreader')

let built = false

// shortcut: macOS-only Vision OCR; on other platforms this throws and the
// client falls back to QR decoding. Build once per server process.
function ensureBinary() {
  if (built || existsSync(BIN)) {
    built = true
    return
  }
  const sources = readdirSync(join(TOOL_DIR, 'Sources'))
    .filter((file) => file.endsWith('.swift'))
    .map((file) => join(TOOL_DIR, 'Sources', file))
  execFileSync('swiftc', ['-O', join(TOOL_DIR, 'main.swift'), ...sources, '-o', BIN], { stdio: 'ignore' })
  built = true
}

function runBinary(images: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // --no-highlight: the overlay PNG is wasted work for an API call.
    execFile(BIN, [...images, '--no-highlight'], { cwd, maxBuffer: 128 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })
}

type RawSlip = {
  file?: string
  amount?: number
  dateTime?: string | null
  transactionId?: string
  type?: string
  recipient?: { name?: string }
}

// One process, all slips: the binary OCRs them in parallel. Results come back
// keyed by "<index>.png" so a slot that failed to read stays null.
export async function readSlipImages(dataUrls: string[]): Promise<(SlipRead | null)[]> {
  const slots: (SlipRead | null)[] = dataUrls.map(() => null)
  if (dataUrls.length === 0) return slots
  ensureBinary()

  const dir = await mkdtemp(join(tmpdir(), 'paytail-slip-'))
  try {
    const paths: string[] = []
    for (let index = 0; index < dataUrls.length; index++) {
      const base64 = dataUrls[index].split(',')[1]
      if (!base64) continue
      const path = join(dir, `${index}.png`)
      await writeFile(path, Buffer.from(base64, 'base64'))
      paths.push(path)
    }
    if (paths.length === 0) return slots

    const stdout = await runBinary(paths, dir)
    const rows = JSON.parse(stdout) as RawSlip[]
    for (const row of rows) {
      const index = Number((row.file ?? '').split('.')[0])
      if (!Number.isInteger(index) || index < 0 || index >= slots.length) continue
      slots[index] = {
        amount: Number(row.amount) || 0,
        dateTime: row.dateTime ?? null,
        transactionId: row.transactionId ?? '',
        title: row.type ?? '',
        recipient: row.recipient?.name ?? '',
      }
    }
    return slots
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
