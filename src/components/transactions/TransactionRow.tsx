import { CategoryIcon } from '@/components/category/CategoryIcon'
import { formatAmount, formatThaiDate } from '@/lib/utils/format'
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

export function TransactionRow({ item }: { item: TransactionItem }) {
  return (
    <div className={styles.row}>
      <CategoryIcon icon={item.categoryIcon ?? 'other'} color={item.categoryColor ?? '#d9d9d9'} />
      <div className={styles.mid}>
        <div className={styles.titleLine}>
          <span className={styles.title}>{item.title}</span>
          {item.payee ? <span className={styles.payee}>{item.payee}</span> : null}
        </div>
        <div className={styles.metaLine}>
          {item.categoryName ? <span className={styles.pill}>{item.categoryName}</span> : null}
          <span className={styles.date}>{formatThaiDate(item.occurredAt)}</span>
        </div>
      </div>
      <div className={styles.amount}>
        {formatAmount(item.amount)}
        <span className={styles.currency}>฿</span>
      </div>
    </div>
  )
}
