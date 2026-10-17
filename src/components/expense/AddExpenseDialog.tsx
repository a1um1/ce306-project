import { Lock, Pen, QrCode } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CategoryIcon } from '@/components/category/CategoryIcon'
import { Modal } from '@/components/ui/Modal'
import type { CategoryRecord } from '@/components/category/CategoryDialog'
import { createExpense } from '@/lib/api/expenses'
import { decodeQrFile, parseSlipPayload } from '@/lib/utils/qr'
import { CATEGORY_COLORS } from '@/lib/utils/design'
import ui from '@/components/ui/ui.module.css'
import styles from '@/components/ui/dialogs.module.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: CategoryRecord[]
  onSaved: () => void
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
  const [qrPayload, setQrPayload] = useState<string | null>(null)
  const [qrStatus, setQrStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setStep('choose')
    setSource('manual')
    setAmount('')
    setTitle('')
    setPayee('')
    setCategoryId(null)
    setQrPayload(null)
    setQrStatus(null)
    setError(null)
  }, [open])

  const startManual = () => {
    setSource('manual')
    setStep('form')
  }

  const startQr = () => {
    setSource('qr')
    setStep('form')
    fileRef.current?.click()
  }

  const onQrFile = async (file: File) => {
    setQrStatus('กำลังอ่าน QR…')
    try {
      const payload = await decodeQrFile(file)
      if (!payload) {
        setQrStatus('อ่าน QR ไม่ได้ ลองรูปที่ชัดขึ้น หรือกรอกเอง')
        return
      }
      setQrPayload(payload)
      const parsed = parseSlipPayload(payload)
      if (parsed.amount) setAmount(String(parsed.amount))
      if (parsed.ref) setTitle(parsed.ref)
      setQrStatus('อ่าน QR สำเร็จ ตรวจสอบข้อมูลก่อนบันทึก')
    } catch {
      setQrStatus('อ่านไฟล์ไม่สำเร็จ')
    }
  }

  const submit = async () => {
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
          categoryId,
          source,
          qrPayload,
        },
      })
      onSaved()
      onOpenChange(false)
    } catch {
      setError('บันทึกไม่สำเร็จ ลองอีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={step === 'choose' ? 'เลือกวิธีการเพิ่ม' : 'กรอกข้อมูลรายจ่าย'}
      width={step === 'choose' ? 560 : 661}
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
            <span>อัปโหลด QR สลิป</span>
          </button>
        </div>
      ) : (
        <>
          {source === 'qr' ? (
            <div className={styles.qrBox}>
              <button type="button" className={ui.small} onClick={() => fileRef.current?.click()}>
                เลือกรูป QR อีกครั้ง
              </button>
              {qrStatus ? <span className={styles.qrStatus}>{qrStatus}</span> : null}
            </div>
          ) : null}

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
                  className={categoryId === c.id ? styles.catActive : styles.cat}
                  onClick={() => setCategoryId(c.id)}
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

          {error ? <p className={styles.error}>{error}</p> : null}

          <button type="button" className={ui.primary} onClick={submit} disabled={busy}>
            {busy ? 'กำลังบันทึก…' : 'จดรายจ่าย'}
          </button>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onQrFile(file)
          e.target.value = ''
        }}
      />
    </Modal>
  )
}
