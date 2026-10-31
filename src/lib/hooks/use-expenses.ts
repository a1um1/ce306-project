import { useExpenses as useTanstackExpenses } from './use-api-queries'
import type { ExpenseFilter, ExpenseRow } from '@/lib/api/expenses'

export function useExpenses(filter: ExpenseFilter, reload = 0) {
  const { data: rows = [], isLoading, isFetching } = useTanstackExpenses(filter)
  
  return { 
    rows: rows as ExpenseRow[], 
    loading: isLoading || isFetching 
  }
}
