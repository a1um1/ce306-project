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
  const mine = categories.filter((c) => c.userId)
  const builtIn = categories.filter((c) => !c.userId)

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="หมวดหมู่" width={520}>
      <span className={ui.label}>หมวดหมู่ของฉัน</span>
      <div className={styles.catList}>
        {mine.map((c) => (
          <div key={c.id} className={styles.catListItem}>
            <CategoryIcon icon={c.icon} color={c.color} size={40} />
            <span className={styles.catListName}>{c.name}</span>
            <button type="button" className={ui.small} onClick={() => onEdit(c)}>
              แก้ไข
            </button>
          </div>
        ))}
        {mine.length === 0 ? <span className={styles.emptyHint}>ยังไม่มีหมวดหมู่ที่คุณสร้าง</span> : null}
      </div>

      <button type="button" className={ui.primary} onClick={onNew}>
        สร้างใหม่
      </button>

      <span className={ui.label}>หมวดหมู่พื้นฐาน (ใช้ร่วมกัน แก้ไขไม่ได้)</span>
      <div className={styles.categoryGrid}>
        {builtIn.map((c) => (
          <div key={c.id} className={styles.catFixed}>
            <CategoryIcon icon={c.icon} color={c.color} size={36} />
            <span>{c.name}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}
