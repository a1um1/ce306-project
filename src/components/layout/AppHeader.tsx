import { useState } from 'react'
import { CategoryDialog, type CategoryRecord } from '@/components/category/CategoryDialog'
import { ManageCategoriesDialog } from '@/components/category/ManageCategoriesDialog'
import { Navbar } from './Navbar'

type Props = {
  user: { name: string; email: string; image?: string | null }
  categories: CategoryRecord[]
  onChanged: () => void
}

export function AppHeader({ user, categories, onChanged }: Props) {
  const [manageOpen, setManageOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryRecord | null>(null)

  return (
    <>
      <Navbar user={user} onManageCategories={() => setManageOpen(true)} />
      <ManageCategoriesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        categories={categories}
        onEdit={(category) => {
          setManageOpen(false)
          setEditing(category)
          setCategoryOpen(true)
        }}
        onNew={() => {
          setManageOpen(false)
          setEditing(null)
          setCategoryOpen(true)
        }}
      />
      <CategoryDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        initial={editing}
        existingCount={categories.length}
        onSaved={onChanged}
      />
    </>
  )
}
