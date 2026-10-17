import { CategoryIcon } from './CategoryIcon'
import { Modal } from '@/components/ui/Modal'
import type { CategoryRecord } from './CategoryDialog'
import ui from '@/components/ui/ui.module.css'
import styles from '@/components/ui/dialogs.module.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: CategoryRecord[]
  onEdit: (category: CategoryRecord) => void
  onNew: () => void
}

export function ManageCategoriesDialog({ open, onOpenChange, categories, onEdit, onNew }: Props) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="หมวดหมู่" width={500}>
      <div className={styles.catList}>
        {categories.map((c) => (
          <div key={c.id} className={styles.catListItem}>
            <CategoryIcon icon={c.icon} color={c.color} size={40} />
            <span className={styles.catListName}>{c.name}</span>
            <button type="button" className={ui.small} onClick={() => onEdit(c)}>
              แก้ไข
            </button>
          </div>
        ))}
        {categories.length === 0 ? <span className={styles.emptyHint}>ยังไม่มีหมวดหมู่</span> : null}
      </div>
      <button type="button" className={ui.primary} onClick={onNew}>
        สร้างใหม่
      </button>
    </Modal>
  )
}
