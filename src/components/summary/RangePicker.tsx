import { RANGE_LABEL, type RangeKey } from '@/lib/utils/format'
import styles from './RangePicker.module.css'

// Relative ranges stay on the current date; the year select picks a whole year.
const KEYS: RangeKey[] = ['today', 'week', 'month', 'halfYear']

// shortcut: only recent years are listed; add data-driven years if older history matters.
const YEAR_BACK = 5

export function RangePicker({
  value,
  year,
  onChange,
  onYearChange,
}: {
  value: RangeKey | null
  year: number
  onChange: (key: RangeKey) => void
  onYearChange: (year: number) => void
}) {
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: YEAR_BACK + 1 }, (_, i) => thisYear - i)
  if (!years.includes(year)) years.unshift(year)

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
      <select
        className={value === 'year' ? styles.yearActive : styles.year}
        value={value === 'year' ? String(year) : ''}
        onChange={(e) => onYearChange(Number(e.target.value))}
        aria-label="เลือกปี"
      >
        <option value="" disabled hidden>
          เลือกปี
        </option>
        {years.map((y) => (
          <option key={y} value={y}>
            ทั้งปี {y + 543}
          </option>
        ))}
      </select>
    </div>
  )
}
