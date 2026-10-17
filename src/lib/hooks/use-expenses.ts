import { useEffect, useState } from 'react'
import { listExpenses, type ExpenseFilter, type ExpenseRow } from '@/lib/api/expenses'

export function useExpenses(filter: ExpenseFilter, reload = 0) {
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    listExpenses({ data: filter })
      .then((result) => {
        if (alive) setRows(result as ExpenseRow[])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [filter.from, filter.to, filter.categoryId, reload])

  return { rows, loading }
}
