import { Lock, Pen, QrCode } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CategoryGrid } from '@/components/category/CategoryGrid'
import type { CategoryRecord } from '@/components/category/CategoryDialog'
import { Modal } from '@/components/ui/Modal'
import { createExpense } from '@/lib/api/expenses'
import { createImportJob } from '@/lib/api/import-jobs'
import { prepareUploads } from '@/lib/utils/read-slip'
import { IMPORT_STARTED_EVENT, IMPORT_WATCH_KEY } from './ImportBanner'
import ui from '@/components/ui/ui.module.css'
import styles from '@/components/ui/dialogs.module.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: CategoryRecord[]
  onSaved: (earliestOccurredAt?: string) => void
  onNewCategory: () => void
}

const QUICK_ADD = [5, 10, 50, 100, 500, 1000]

export function AddExpenseDialog({ open, onOpenChange, categories, onSaved, onNewCategory }: Props) {
  const [step, setStep] = useState<'choose' | 'form'>('choose')
  const [source, setSource] = useState<'manual' | 'qr'>('manual')

  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [payee, setPayee] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)

  // Slips are handed to a background job, so there is no review step: pick, then
  // upload. `saving` is the hand-off itself.
  const [phase, setPhase] = useState<'pick' | 'upload' | 'saving'>('pick')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [dragging, setDragging] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // New transactions start on the first category instead of none.
  const defaultCategoryId = categories[0]?.id ?? null
  const manualCategory = categoryId ?? defaultCategoryId

  useEffect(() => {
    if (!open) return
    setStep('choose')
    setSource('manual')
    setAmount('')
    setTitle('')
    setPayee('')
    setCategoryId(null)
    setPhase('pick')
    setProgress({ done: 0, total: 0 })
    setError(null)
  }, [open])

  const startManual = () => {
    setSource('manual')
    setStep('form')
  }

  const openPicker = () => fileRef.current?.click()

  const startQr = () => {
    setSource('qr')
    setStep('form')
    setPhase('pick')
  }

  // Prepare the images, hand them to the server, and close: the import runs in
  // the background and the progress banner takes over.
  const readFiles = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return
    setError(null)
    setPhase('upload')
    setProgress({ done: 0, total: images.length })

    try {
      const prepared = await prepareUploads(images, (done, total) => setProgress({ done, total }))
      setPhase('saving')
      const { id } = await createImportJob({ data: { images: prepared } })
      if (!id) {
        setError('ไม่พบรูปที่อ่านได้ ลองอีกครั้ง')
        setPhase('pick')
        return
      }
      localStorage.setItem(IMPORT_WATCH_KEY, id)
      window.dispatchEvent(new Event(IMPORT_STARTED_EVENT))
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'อัปโหลดไม่สำเร็จ ลองอีกครั้ง')
      setPhase('pick')
    }
  }

  const onFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    void readFiles(files)
  }

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    void readFiles(Array.from(event.dataTransfer.files))
  }

  const submitManual = async () => {
    const value = Number(amount)
    if (!title.trim()) return setError('ใส่ชื่อรายการก่อน')
    if (!value || value <= 0) return setError('ใส่จำนวนเงินก่อน')
    setBusy(true)
    setError(null)
    try {
      await createExpense({
        data: {
          title: title.trim(),
          payee: payee.trim() || null,
          amount: value,
          occurredAt: new Date().toISOString(),
          categoryId: manualCategory,
          source: 'manual',
          qrPayload: null,
        },
      })
      onSaved()
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ ลองอีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  const modalTitle =
    step === 'choose' ? 'เลือกวิธีการเพิ่ม' : source === 'qr' ? 'อัปโหลดสลิป / QR' : 'กรอกข้อมูลรายจ่าย'

  // Preparing or sending the batch is unsaved work: don't let a stray click or
  // Escape throw it away. The close button still works.
  const importing = source === 'qr' && (phase === 'upload' || phase === 'saving')

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={modalTitle}
      width={step === 'choose' ? 560 : 780}
      dismissible={!importing}
    >
      {step === 'choose' ? (
        <div className={styles.methods}>
          <div className={`${styles.method} ${styles.methodLocked}`} aria-disabled>
            <img src="/assets/google-photos.svg" alt="" width={48} height={48} />
            <span>เพิ่มจาก Google Photos</span>
            <span className={styles.lockTag}>
              <Lock size={14} strokeWidth={2} /> ยังใช้งานไม่ได้
            </span>
          </div>
          <button type="button" className={`${styles.method} ${styles.methodManual}`} onClick={startManual}>
            <Pen size={24} strokeWidth={2} />
            <span>กรอกข้อมูลเอง</span>
          </button>
          <button type="button" className={`${styles.method} ${styles.methodQr}`} onClick={startQr}>
            <QrCode size={24} strokeWidth={2} />
            <span>อัปโหลดสลิป / QR</span>
          </button>
        </div>
      ) : source === 'qr' ? (
        phase === 'pick' ? (
          <>
            <button
              type="button"
              className={dragging ? styles.dropzoneActive : styles.dropzone}
              onClick={openPicker}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <QrCode size={40} strokeWidth={1.5} />
              <span className={styles.dropzoneText}>ลากรูปสลิปมาวาง หรือกดเลือกไฟล์</span>
              <span className={styles.dropzoneHint}>อัปโหลดครั้งเดียว ที่เหลือทำงานเบื้องหลัง</span>
            </button>
            {error ? <p className={styles.error}>{error}</p> : null}
          </>
        ) : (
          <div className={styles.progressWrap}>
            <span className={styles.progressText}>
              {phase === 'saving' ? 'กำลังส่งเข้าคิว…' : `กำลังเตรียมไฟล์ ${progress.done}/${progress.total}`}
            </span>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${
                    phase === 'saving' ? 100 : progress.total ? (progress.done / progress.total) * 100 : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )
      ) : (
        <>
          <div className={styles.amountRow}>
            <input
              className={styles.amountInput}
              value={amount}
              inputMode="decimal"
              placeholder="0"
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </div>
          <div className={styles.quickRow}>
            {QUICK_ADD.map((n) => (
              <button
                key={n}
                type="button"
                className={ui.small}
                onClick={() => setAmount(String((Number(amount) || 0) + n))}
              >
                +{n}
              </button>
            ))}
          </div>

          <div className={ui.inputGroup}>
            <label className={ui.label} htmlFor="expense-title">
              ชื่อรายการ
            </label>
            <input
              id="expense-title"
              className={ui.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ค่ารถ ค่า BTS ค่ากิน"
            />
          </div>

          <div className={ui.inputGroup}>
            <label className={ui.label} htmlFor="expense-payee">
              จ่ายให้
            </label>
            <input
              id="expense-payee"
              className={ui.input}
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="แม่ พ่อ 7-11"
            />
          </div>

          <CategoryGrid
            categories={categories}
            selected={manualCategory}
            onSelect={setCategoryId}
            onNewCategory={onNewCategory}
          />

          {error ? <p className={styles.error}>{error}</p> : null}

          <button type="button" className={ui.primary} onClick={submitManual} disabled={busy}>
            {busy ? 'กำลังบันทึก…' : 'จดรายจ่าย'}
          </button>
        </>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFileInput} />
    </Modal>
  )
}
