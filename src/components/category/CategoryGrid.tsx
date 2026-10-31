import { useMemo, useState } from 'react'
import { CategoryIcon } from '@/components/category/CategoryIcon'
import type { CategoryRecord } from '@/components/category/CategoryDialog'
import { CATEGORY_COLORS } from '@/lib/utils/design'
import { Button } from '@/components/ui/Button'
import ui from '@/components/ui/ui.module.css'
import styles from '@/components/ui/dialogs.module.css'

type Props = {
  categories: CategoryRecord[]
  selected: string | null
  onSelect: (id: string) => void
  onNewCategory?: () => void
}

// .categoryGrid is 6 columns wide, so two rows hold this many tiles.
const COLUMNS = 6
const COLLAPSED_ROWS = 2

export function CategoryGrid({ categories, selected, onSelect, onNewCategory }: Props) {
  const [expanded, setExpanded] = useState(false)

  // The user's own categories sit in their own row above the built-ins;
  // built-ins are ordered by how often this account uses them. Ties keep the
  // server order (created_at), which is the display order.
  const { mine, builtIn } = useMemo(() => {
    const mine = categories.filter((c) => c.userId)
    const builtIn = categories.filter((c) => !c.userId).sort((a, b) => (b.usage ?? 0) - (a.usage ?? 0))
    return { mine, builtIn }
  }, [categories])

  const limit = COLLAPSED_ROWS * COLUMNS
  const visible = expanded ? builtIn : builtIn.slice(0, limit)

  const renderTile = (c: CategoryRecord, index: number) => (
    <button
      key={c.id}
      type="button"
      className={selected === c.id ? styles.catActive : styles.cat}
      onClick={() => onSelect(c.id)}
    >
      <CategoryIcon icon={c.icon} color={c.color ?? CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
      <span>{c.name}</span>
    </button>
  )

  return (
    <div className={styles.categoryBlock}>
      <div className={styles.categoryHeader}>
        <span className={ui.label}>เลือกหมวดหมู่</span>
        {onNewCategory ? (
          <Button variant="secondary" size="sm" onClick={onNewCategory}>
            สร้างใหม่
          </Button>
        ) : null}
      </div>

      {mine.length > 0 ? (
        <div className={styles.categoryGroup}>
          <span className={styles.groupLabel}>หมวดหมู่ของฉัน</span>
          <div className={styles.categoryGrid}>{mine.map(renderTile)}</div>
        </div>
      ) : null}

      <div className={styles.categoryGroup}>
        {mine.length > 0 ? <span className={styles.groupLabel}>หมวดหมู่พื้นฐาน</span> : null}
        <div className={styles.categoryGrid}>
          {visible.map(renderTile)}
          {categories.length === 0 ? (
            <span className={styles.emptyHint}>ยังไม่มีหมวดหมู่ กด “สร้างใหม่”</span>
          ) : null}
        </div>

        {builtIn.length > limit ? (
          <button
            type="button"
            className={styles.expandToggle}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'ย่อ' : `ดูทั้งหมด (${builtIn.length})`}
          </button>
        ) : null}
      </div>
    </div>
  )
}
