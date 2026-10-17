import { Pen, Trash2 } from 'lucide-react'
import { CategoryIcon } from '@/components/category/CategoryIcon'
import { formatAmount, formatTime } from '@/lib/utils/format'
import styles from './TransactionRow.module.css'

export type TransactionItem = {
  id: string
  title: string
  payee: string | null
  amount: string
  occurredAt: string | Date
  categoryName: string | null
  categoryIcon: string | null
  categoryColor: string | null
}

type Props = {
  item: TransactionItem
  disabled?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export function TransactionRow({ item, disabled, onEdit, onDelete }: Props) {
  return (
    <div className={styles.row}>
      <CategoryIcon icon={item.categoryIcon ?? 'other'} color={item.categoryColor ?? '#d9d9d9'} />
      <div className={styles.mid}>
        <div className={styles.titleLine}>
          <span className={styles.title}>{item.title}</span>
          {item.payee ? <span className={styles.payee}>{item.payee}</span> : null}
        </div>
        <div className={styles.metaLine}>
          <span
            className={item.categoryName ? styles.pill : styles.pillNone}
            style={item.categoryName ? { background: item.categoryColor ?? 'var(--muted)' } : undefined}
          >
            {item.categoryName ?? 'ไม่ระบุ'}
          </span>
          <span className={styles.date}>{formatTime(item.occurredAt)}</span>
        </div>
      </div>
      <div className={styles.amount}>
        {formatAmount(item.amount)}
        <span className={styles.currency}>฿</span>
      </div>
      {onEdit || onDelete ? (
        <div className={styles.actions}>
          {onEdit ? (
            <button
              type="button"
              className={styles.iconButton}
              onClick={onEdit}
              disabled={disabled}
              aria-label={`แก้ไข ${item.title}`}
            >
              <Pen size={20} strokeWidth={2} />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className={styles.iconButton}
              onClick={onDelete}
              disabled={disabled}
              aria-label={`ลบ ${item.title}`}
            >
              <Trash2 size={20} strokeWidth={2} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
