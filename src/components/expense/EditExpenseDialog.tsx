import { useEffect, useState } from 'react'
import type { CategoryRecord } from '@/components/category/CategoryDialog'
import { CategoryGrid } from '@/components/category/CategoryGrid'
import { Modal } from '@/components/ui/Modal'
import { updateExpense, type ExpenseRow } from '@/lib/api/expenses'
import ui from '@/components/ui/ui.module.css'
import styles from '@/components/ui/dialogs.module.css'

type Props = {
  open: boolean
  item: ExpenseRow | null
  categories: CategoryRecord[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function EditExpenseDialog({ open, item, categories, onOpenChange, onSaved }: Props) {
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [payee, setPayee] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !item) return
    setAmount(item.amount)
    setTitle(item.title)
    setPayee(item.payee ?? '')
    setCategoryId(item.categoryId)
    setError(null)
  }, [open, item])

  const submit = async () => {
    if (!item) return
    const value = Number(amount)
    if (!title.trim()) return setError('ใส่ชื่อรายการก่อน')
    if (!value || value <= 0) return setError('ใส่จำนวนเงินก่อน')
    setBusy(true)
    setError(null)
    try {
      await updateExpense({
        data: {
          id: item.id,
          title: title.trim(),
          payee: payee.trim() || null,
          amount: value,
          categoryId,
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

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="แก้ไขรายจ่าย" width={780}>
      <div className={styles.amountRow}>
        <input
          className={styles.amountInput}
          value={amount}
          inputMode="decimal"
          placeholder="0"
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
        />
      </div>

      <div className={ui.inputGroup}>
        <label className={ui.label} htmlFor="edit-expense-title">
          ชื่อรายการ
        </label>
        <input
          id="edit-expense-title"
          className={ui.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ค่ารถ ค่า BTS ค่ากิน"
        />
      </div>

      <div className={ui.inputGroup}>
        <label className={ui.label} htmlFor="edit-expense-payee">
          จ่ายให้
        </label>
        <input
          id="edit-expense-payee"
          className={ui.input}
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
          placeholder="แม่ พ่อ 7-11"
        />
      </div>

      <CategoryGrid categories={categories} selected={categoryId} onSelect={setCategoryId} />

      {error ? <p className={styles.error}>{error}</p> : null}

      <button type="button" className={ui.primary} onClick={submit} disabled={busy}>
        {busy ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}
      </button>
    </Modal>
  )
}
