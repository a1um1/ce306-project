import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ExpenseFilter, ExpenseRow, Expense, ExpenseInput, ExpenseUpdate } from '@/lib/api/types'
import type { Category, CategoryInput } from '@/lib/api/types'
import type { ImportJobView } from '@/lib/api/types'
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  listImportedExternalIds,
  importExpenses,
} from '@/lib/api/expenses'
import { listCategories, createCategory, updateCategory, suggestCategories } from '@/lib/api/categories'
import { getImportJob, createImportJob } from '@/lib/api/import-jobs'
import { getSession } from '@/lib/api/session'
import type { UploadImage } from '@/lib/api/types'

// Query keys for cache management
export const queryKeys = {
  categories: ['categories'] as const,
  category: (id: string) => ['categories', id] as const,
  expenses: (filter: ExpenseFilter) => ['expenses', filter] as const,
  expense: (id: string) => ['expenses', id] as const,
  session: ['session'] as const,
  importJob: (id: string) => ['import-jobs', id] as const,
  importedExternalIds: ['imported-external-ids'] as const,
} as const

// ============================================================================
// Categories
// ============================================================================

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: listCategories,
    staleTime: 1000 * 60 * 60, // 1 hour
  })
}

export function useCategory(id: string) {
  return useQuery({
    queryKey: queryKeys.category(id),
    queryFn: async () => {
      const categories = await listCategories()
      return categories.find((c) => c.id === id) ?? null
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 60, // 1 hour
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: queryKeys.categories })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CategoryInput }) => updateCategory(id, input),
    onSuccess: (_, { id }) => {
      return queryClient.invalidateQueries({ queryKey: queryKeys.categories })
    },
  })
}

export function useSuggestCategories() {
  return useMutation({
    mutationFn: suggestCategories,
  })
}

// ============================================================================
// Expenses
// ============================================================================

export function useExpenses(filter: ExpenseFilter) {
  return useQuery({
    queryKey: queryKeys.expenses(filter),
    queryFn: () => listExpenses(filter),
    staleTime: 1000 * 30, // 30 seconds
  })
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: queryKeys.expense(id),
    queryFn: async () => {
      const expenses = await listExpenses({})
      return expenses.find((e) => e.id === id) ?? null
    },
    enabled: !!id,
    staleTime: 1000 * 30, // 30 seconds
  })
}

export function useCreateExpense() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: queryKeys.expenses })
    },
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ExpenseUpdate }) => updateExpense(id, input),
    onSuccess: (_, { id }) => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses }),
        queryClient.invalidateQueries({ queryKey: queryKeys.expense(id) }),
      ])
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: queryKeys.expenses })
    },
  })
}

export function useImportExpenses() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: importExpenses,
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: queryKeys.expenses })
    },
  })
}

export function useImportedExternalIds() {
  return useQuery({
    queryKey: queryKeys.importedExternalIds,
    queryFn: listImportedExternalIds,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// ============================================================================
// Import Jobs
// ============================================================================

export function useImportJob(id: string) {
  return useQuery({
    queryKey: queryKeys.importJob(id),
    queryFn: () => getImportJob(id),
    enabled: !!id,
    staleTime: 1000 * 5, // 5 seconds
    refetchInterval: 1000 * 5, // Poll every 5 seconds
  })
}

export function useCreateImportJob() {
  return useMutation({
    mutationFn: createImportJob,
  })
}

// ============================================================================
// Session
// ============================================================================

export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: getSession,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
