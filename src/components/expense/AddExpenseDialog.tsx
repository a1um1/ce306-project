import { Lock, Pen, QrCode, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CategoryIcon } from '@/components/category/CategoryIcon'
import type { CategoryRecord } from '@/components/category/CategoryDialog'
import { Modal } from '@/components/ui/Modal'
import { createExpense, importExpenses, listImportedExternalIds } from '@/lib/api/expenses'
import { CATEGORY_COLORS } from '@/lib/utils/design'
import { formatAmount, formatThaiDate } from '@/lib/utils/format'
import { readSlipFiles } from '@/lib/utils/read-slip'
import ui from '@/components/ui/ui.module.css'
import styles from '@/components/ui/dialogs.module.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: CategoryRecord[]
  onSaved: (earliestOccurredAt?: string) => void
  onNewCategory: () => void
}

type BatchItem = {
  key: string
  thumb: string
  title: string
  amount: string
  dateTime: string | null
  payload: string | null
  externalId: string | null
  via: 'ocr' | 'qr' | 'none'
  include: boolean
  duplicate: boolean
}

const QUICK_ADD = [5, 10, 50, 100, 500, 1000]

const VIA_LABEL: Record<BatchItem['via'], string> = {
  ocr: 'อ่านสลิป',
  qr: 'อ่าน QR',
  none: 'อ่านไม่ได้',
}

export function AddExpenseDialog({ open, onOpenChange, categories, onSaved, onNewCategory }: Props) {
  const [step, setStep] = useState<'choose' | 'form'>('choose')
  const [source, setSource] = useState<'manual' | 'qr'>('manual')

  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [payee, setPayee] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const [phase, setPhase] = useState<'pick' | 'processing' | 'summary'>('pick')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [items, setItems] = useState<BatchItem[]>([])
  const [batchCategoryId, setBatchCategoryId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // New transactions start on the first category instead of none.
  const defaultCategoryId = categories[0]?.id ?? null
  const manualCategory = categoryId ?? defaultCategoryId
  const batchCategory = batchCategoryId ?? defaultCategoryId

  useEffect(() => {
    if (!open) return
    setStep('choose')
    setSource('manual')
    setAmount('')
    setTitle('')
    setPayee('')
    setCategoryId(null)
    setBatchCategoryId(null)
    setItems([])
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
    setItems([])
  }

  const readFiles = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return
    setPhase('processing')
    setProgress({ done: 0, total: images.length })
    setItems([])

    const readings = await readSlipFiles(images, (done, total) => setProgress({ done, total }))

    let known: string[] = []
    try {
      known = await listImportedExternalIds()
    } catch {
      known = []
    }
    // Anything already stored, plus repeats inside this batch, is a duplicate.
    const seen = new Set(known)
    const parsed = readings.map((reading): BatchItem => {
      const duplicate = Boolean(reading.externalId && seen.has(reading.externalId))
      if (reading.externalId) seen.add(reading.externalId)
      return {
        key: crypto.randomUUID(),
        thumb: reading.thumb,
        title: reading.title,
        amount: reading.amount,
        dateTime: reading.dateTime,
        payload: reading.payload,
        externalId: reading.externalId,
        via: reading.via,
        include: Number(reading.amount) > 0 && !duplicate,
        duplicate,
      }
    })

    setItems(parsed)
    setPhase('summary')
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

  const updateItem = (key: string, patch: Partial<BatchItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key))
  }

  const included = items.filter((item) => item.include && !item.duplicate && Number(item.amount) > 0)
  const batchTotal = included.reduce((sum, item) => sum + Number(item.amount), 0)

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

  const submitBatch = async () => {
    if (included.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await importExpenses({
        data: {
          items: included.map((item) => ({
            title: item.title.trim() || 'สลิป',
            payee: null,
            amount: Number(item.amount),
            occurredAt: item.dateTime ?? new Date().toISOString(),
            categoryId: batchCategory,
            source: 'qr' as const,
            qrPayload: item.payload,
            externalId: item.externalId,
          })),
        },
      })
      const earliest = included
        .map((item) => (item.dateTime ? new Date(item.dateTime).getTime() : Date.now()))
        .reduce((min, time) => Math.min(min, time), Number.POSITIVE_INFINITY)
      onSaved(Number.isFinite(earliest) ? new Date(earliest).toISOString() : undefined)
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'นำเข้าไม่สำเร็จ ลองอีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  const modalTitle =
    step === 'choose'
      ? 'เลือกวิธีการเพิ่ม'
      : source === 'qr'
        ? phase === 'summary'
          ? 'ตรวจสอบก่อนนำเข้า'
          : 'อัปโหลด QR สลิป'
        : 'กรอกข้อมูลรายจ่าย'

  const categoryGrid = (selected: string | null, onSelect: (id: string) => void) => (
    <div className={styles.categoryBlock}>
      <div className={styles.categoryHeader}>
        <span className={ui.label}>เลือกหมวดหมู่</span>
        <button type="button" className={ui.small} onClick={onNewCategory}>
          สร้างใหม่
        </button>
      </div>
      <div className={styles.categoryGrid}>
        {categories.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className={selected === c.id ? styles.catActive : styles.cat}
            onClick={() => onSelect(c.id)}
          >
            <CategoryIcon icon={c.icon} color={c.color ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
            <span>{c.name}</span>
          </button>
        ))}
        {categories.length === 0 ? (
          <span className={styles.emptyHint}>ยังไม่มีหมวดหมู่ กด “สร้างใหม่”</span>
        ) : null}
      </div>
    </div>
  )

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={modalTitle} width={step === 'choose' ? 560 : 780}>
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
        <>
          {phase === 'pick' ? (
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
              <span className={styles.dropzoneHint}>เลือกได้หลายรูปพร้อมกัน</span>
            </button>
          ) : null}

          {phase === 'processing' ? (
            <div className={styles.progressWrap}>
              <span className={styles.progressText}>
                กำลังอ่านสลิป {progress.done}/{progress.total}
              </span>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ) : null}

          {phase === 'summary' ? (
            <>
              <div className={styles.summaryStats}>
                <span>
                  นำเข้า {included.length}/{items.length} รายการ
                  {items.some((item) => item.duplicate)
                    ? ` · ซ้ำ ${items.filter((item) => item.duplicate).length}`
                    : ''}
                </span>
                <span className={styles.summaryTotal}>รวม {formatAmount(batchTotal)}฿</span>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.colCheck}>นำเข้า</th>
                      <th>รูป</th>
                      <th>ชื่อรายการ</th>
                      <th>วันที่</th>
                      <th className={styles.colAmount}>จำนวนเงิน</th>
                      <th>ที่มา</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.key} className={item.include && !item.duplicate ? undefined : styles.rowSkipped}>
                        <td className={styles.colCheck}>
                          <input
                            type="checkbox"
                            checked={item.include}
                            disabled={item.duplicate || Number(item.amount) <= 0}
                            onChange={(e) => updateItem(item.key, { include: e.target.checked })}
                            aria-label="นำเข้ารายการนี้"
                          />
                        </td>
                        <td>
                          {item.thumb ? <img className={styles.thumb} src={item.thumb} alt="" /> : null}
                        </td>
                        <td>
                          <input
                            className={styles.cellInput}
                            value={item.title}
                            onChange={(e) => updateItem(item.key, { title: e.target.value })}
                            placeholder="ชื่อรายการ"
                          />
                        </td>
                        <td className={styles.cellDate}>
                          {item.dateTime ? formatThaiDate(item.dateTime) : '—'}
                        </td>
                        <td className={styles.colAmount}>
                          <input
                            className={styles.cellAmount}
                            value={item.amount}
                            inputMode="decimal"
                            placeholder="0"
                            onChange={(e) =>
                              updateItem(item.key, {
                                amount: e.target.value.replace(/[^0-9.]/g, ''),
                                include: true,
                              })
                            }
                          />
                        </td>
                        <td>
                          <span
                            className={
                              item.duplicate || item.via === 'none' ? styles.statusErr : styles.statusOk
                            }
                          >
                            {item.duplicate ? 'ซ้ำ · ข้าม' : VIA_LABEL[item.via]}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.removeBtn}
                            onClick={() => removeItem(item.key)}
                            aria-label="ลบรายการนี้ออก"
                          >
                            <X size={16} strokeWidth={2} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {categoryGrid(batchCategory, setBatchCategoryId)}

              {error ? <p className={styles.error}>{error}</p> : null}

              <div className={styles.summaryActions}>
                <button type="button" className={ui.small} onClick={openPicker} disabled={busy}>
                  เลือกไฟล์อีกครั้ง
                </button>
                <button
                  type="button"
                  className={ui.primary}
                  onClick={submitBatch}
                  disabled={busy || included.length === 0}
                >
                  {busy ? 'กำลังนำเข้า…' : `นำเข้า ${included.length} รายการ`}
                </button>
              </div>
            </>
          ) : null}
        </>
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

          {categoryGrid(manualCategory, setCategoryId)}

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
