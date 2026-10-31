import { useEffect, useState } from 'react'
import type { CategoryRecord } from '@/components/category/CategoryDialog'
import { CategoryGrid } from '@/components/category/CategoryGrid'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { updateExpense, type ExpenseRow } from '@/lib/api/expenses'
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
      await updateExpense(item.id, {
        title: title.trim(),
        payee: payee.trim() || null,
        amount: value,
        categoryId,
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

      <Input
        id="edit-expense-title"
        label="ชื่อรายการ"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="ค่ารถ ค่า BTS ค่ากิน"
      />

      <Input
        id="edit-expense-payee"
        label="จ่ายให้"
        value={payee}
        onChange={(e) => setPayee(e.target.value)}
        placeholder="แม่ พ่อ 7-11"
      />

      <CategoryGrid categories={categories} selected={categoryId} onSelect={setCategoryId} />

      {error ? <p className={styles.error}>{error}</p> : null}

      <Button fullWidth size="lg" onClick={submit} disabled={busy}>
        {busy ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}
      </Button>
    </Modal>
  )
}
