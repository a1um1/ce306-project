import { RANGE_LABEL, type RangeKey } from '@/lib/utils/format'
import styles from './RangePicker.module.css'

const KEYS: RangeKey[] = ['today', 'week', 'month', 'halfYear']

export function RangePicker({ value, onChange }: { value: RangeKey; onChange: (key: RangeKey) => void }) {
  return (
    <div className={styles.picker}>
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={value === key ? styles.active : styles.item}
          onClick={() => onChange(key)}
        >
          {RANGE_LABEL[key]}
        </button>
      ))}
    </div>
  )
}
