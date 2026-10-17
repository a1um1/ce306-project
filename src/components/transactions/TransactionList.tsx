import { useState } from 'react'
import type { CategoryRecord } from '@/components/category/CategoryDialog'
import { EditExpenseDialog } from '@/components/expense/EditExpenseDialog'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { deleteExpense, type ExpenseRow } from '@/lib/api/expenses'
import page from '@/components/layout/page.module.css'

type Props = {
  rows: ExpenseRow[]
  loading: boolean
  categories: CategoryRecord[]
  empty: string
  onChanged: () => void
}

export function TransactionList({ rows, loading, categories, empty, onChanged }: Props) {
  const [editing, setEditing] = useState<ExpenseRow | null>(null)
  const [busy, setBusy] = useState(false)

  const remove = async (item: ExpenseRow) => {
    if (!window.confirm(`ลบ “${item.title}” ออกถาวร?`)) return
    setBusy(true)
    try {
      await deleteExpense({ data: { id: item.id } })
      onChanged()
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'ลบไม่สำเร็จ ลองอีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className={page.list}>
        {rows.length === 0 ? (
          <div className={page.empty}>{loading ? 'กำลังโหลด…' : empty}</div>
        ) : (
          rows.map((row) => (
            <TransactionRow
              key={row.id}
              item={row}
              disabled={busy}
              onEdit={() => setEditing(row)}
              onDelete={() => void remove(row)}
            />
          ))
        )}
      </div>

      <EditExpenseDialog
        open={editing !== null}
        item={editing}
        categories={categories}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onSaved={() => {
          setEditing(null)
          onChanged()
        }}
      />
    </>
  )
}
