import { CategoryIcon } from '@/components/category/CategoryIcon'
import { RangeChart } from './RangeChart'
import { RangePicker } from './RangePicker'
import { formatAmount, type RangeKey } from '@/lib/utils/format'
import type { BreakdownSlice, SummaryRow } from '@/lib/utils/summary'
import styles from './Summarize.module.css'

type Props = {
  total: number
  rows: SummaryRow[]
  slices: BreakdownSlice[]
  bounds: { from: string; to: string }
  range: RangeKey
  year: number
  onRangeChange: (key: RangeKey) => void
  onYearChange: (year: number) => void
}

export function Summarize({ total, rows, slices, bounds, range, year, onRangeChange, onYearChange }: Props) {
  return (
    <section className={styles.card}>
      <div className={styles.chartWrap}>
        <RangeChart range={range} bounds={bounds} rows={rows} slices={slices} />
      </div>

      <div className={styles.right}>
        <div className={styles.head}>
          <div className={styles.usage}>
            <p className={styles.usageLabel}>ยอดใช้จ่าย</p>
            <p className={styles.usageTotal}>{formatAmount(total)}฿</p>
          </div>
          <RangePicker value={range} year={year} onChange={onRangeChange} onYearChange={onYearChange} />
        </div>

        {slices.length > 0 ? (
          <ul className={styles.breakdown}>
            {slices.map((slice) => (
              <li key={slice.key} className={styles.breakdownItem}>
                <CategoryIcon icon={slice.icon ?? 'other'} color={slice.color ?? '#d9d9d9'} size={32} />
                <span className={styles.breakdownName}>{slice.name}</span>
                <span className={styles.breakdownTrack}>
                  <span
                    className={styles.breakdownFill}
                    style={{
                      width: `${total > 0 ? (slice.value / total) * 100 : 0}%`,
                      background: slice.color ?? '#d9d9d9',
                    }}
                  />
                </span>
                <span className={styles.breakdownValue}>{formatAmount(slice.value)}฿</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
