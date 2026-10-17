import { CategoryIcon } from '@/components/category/CategoryIcon'
import type { CategoryRecord } from '@/components/category/CategoryDialog'
import { CATEGORY_COLORS } from '@/lib/utils/design'
import ui from '@/components/ui/ui.module.css'
import styles from '@/components/ui/dialogs.module.css'

type Props = {
  categories: CategoryRecord[]
  selected: string | null
  onSelect: (id: string) => void
  onNewCategory?: () => void
}

export function CategoryGrid({ categories, selected, onSelect, onNewCategory }: Props) {
  return (
    <div className={styles.categoryBlock}>
      <div className={styles.categoryHeader}>
        <span className={ui.label}>เลือกหมวดหมู่</span>
        {onNewCategory ? (
          <button type="button" className={ui.small} onClick={onNewCategory}>
            สร้างใหม่
          </button>
        ) : null}
      </div>
      <div className={styles.categoryGrid}>
        {categories.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className={selected === c.id ? styles.catActive : styles.cat}
            onClick={() => onSelect(c.id)}
          >
            <CategoryIcon icon={c.icon} color={c.color ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
            <span>{c.name}</span>
          </button>
        ))}
        {categories.length === 0 ? (
          <span className={styles.emptyHint}>ยังไม่มีหมวดหมู่ กด “สร้างใหม่”</span>
        ) : null}
      </div>
    </div>
  )
}
