import { Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getImportJob, type ImportJobView } from '@/lib/api/import-jobs'
import styles from './ImportBanner.module.css'

// The dialog hands the job id here through localStorage, so the banner survives
// navigation and a page reload — and the job itself survives the tab closing.
export const IMPORT_WATCH_KEY = 'paytail:import-watch'
export const IMPORT_STARTED_EVENT = 'paytail:import-started'
export const IMPORTED_EVENT = 'paytail:imported'

export function ImportBanner() {
  const [id, setId] = useState<string | null>(null)
  const [job, setJob] = useState<ImportJobView | null>(null)

  const dismiss = () => {
    localStorage.removeItem(IMPORT_WATCH_KEY)
    setId(null)
    setJob(null)
  }

  useEffect(() => {
    const read = () => setId(localStorage.getItem(IMPORT_WATCH_KEY))
    read()
    window.addEventListener(IMPORT_STARTED_EVENT, read)
    return () => window.removeEventListener(IMPORT_STARTED_EVENT, read)
  }, [])

  useEffect(() => {
    if (!id) return
    let alive = true
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const next = await getImportJob({ data: { id } })
        if (!alive) return
        if (!next) return dismiss()
        setJob(next)
        if (next.status === 'done' || next.status === 'failed') {
          localStorage.removeItem(IMPORT_WATCH_KEY)
          window.dispatchEvent(new CustomEvent(IMPORTED_EVENT, { detail: { earliestAt: next.earliestAt } }))
          timer = setTimeout(() => {
            if (alive) {
              setId(null)
              setJob(null)
            }
          }, 8000)
          return
        }
        timer = setTimeout(poll, 1500)
      } catch {
        timer = setTimeout(poll, 3000)
      }
    }

    setJob(null)
    timer = setTimeout(poll, 200)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [id])

  if (!id || !job) return null

  const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0
  const running = job.status === 'pending' || job.status === 'processing'
  const detail = [job.skipped ? `ซ้ำ ${job.skipped}` : '', job.failed ? `อ่านไม่ได้ ${job.failed}` : '']
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <div className={styles.head}>
        {running ? <Loader2 className={styles.spinner} size={18} strokeWidth={2} /> : null}
        <span className={styles.label}>
          {job.status === 'failed'
            ? 'นำเข้าไม่สำเร็จ'
            : running
              ? `กำลังนำเข้าสลิป ${job.processed}/${job.total}`
              : `นำเข้าสำเร็จ ${job.imported} รายการ`}
        </span>
        <button type="button" className={styles.close} onClick={dismiss} aria-label="ปิด">
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      {running ? (
        <div className={styles.bar}>
          <div className={styles.fill} style={{ width: `${pct}%` }} />
        </div>
      ) : null}

      <span className={styles.sub}>
        {job.status === 'failed'
          ? (job.error ?? 'ลองอัปโหลดอีกครั้ง')
          : running
            ? 'ทำงานเบื้องหลัง ปิดหน้านี้ได้เลย'
            : detail || 'เรียบร้อย'}
      </span>
    </div>
  )
}
