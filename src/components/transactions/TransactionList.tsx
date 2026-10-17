import { Fragment, useMemo, useState } from 'react'
import type { CategoryRecord } from '@/components/category/CategoryDialog'
import { EditExpenseDialog } from '@/components/expense/EditExpenseDialog'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { deleteExpense, type ExpenseRow } from '@/lib/api/expenses'
import { dayLabel, toDateKey } from '@/lib/utils/format'
import page from '@/components/layout/page.module.css'

type Props = {
  rows: ExpenseRow[]
  loading: boolean
  categories: CategoryRecord[]
  empty: string
  onChanged: () => void
  // Only meaningful when rows are in date order (see the transactions sort).
  grouped?: boolean
}

export function TransactionList({ rows, loading, categories, empty, onChanged, grouped }: Props) {
  const [editing, setEditing] = useState<ExpenseRow | null>(null)
  const [busy, setBusy] = useState(false)

  const groups = useMemo(() => {
    const list: { key: string; items: ExpenseRow[] }[] = []
    for (const row of rows) {
      const key = toDateKey(new Date(row.occurredAt))
      const last = list[list.length - 1]
      if (last && last.key === key) last.items.push(row)
      else list.push({ key, items: [row] })
    }
    return list
  }, [rows])

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

  const renderRow = (row: ExpenseRow) => (
    <TransactionRow
      key={row.id}
      item={row}
      disabled={busy}
      onEdit={() => setEditing(row)}
      onDelete={() => void remove(row)}
    />
  )

  return (
    <>
      <div className={page.list}>
        {rows.length === 0 ? (
          <div className={page.empty}>{loading ? 'กำลังโหลด…' : empty}</div>
        ) : grouped ? (
          groups.map((group) => (
            <Fragment key={group.key}>
              <div className={page.dayHeader}>{dayLabel(group.key)}</div>
              {group.items.map(renderRow)}
            </Fragment>
          ))
        ) : (
          rows.map(renderRow)
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
