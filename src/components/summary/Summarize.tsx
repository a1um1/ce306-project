import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CategoryIcon } from '@/components/category/CategoryIcon'
import { RangeChart } from './RangeChart'
import { RangePicker } from './RangePicker'
import { RollingNumber } from './RollingNumber'
import { formatAmount, toDateKey, type RangeKey } from '@/lib/utils/format'
import type { BreakdownSlice, SummaryRow } from '@/lib/utils/summary'
import styles from './Summarize.module.css'

// Categories shown before the list collapses.
const COLLAPSED = 6

type Props = {
  total: number
  previousTotal?: number | null
  rows: SummaryRow[]
  slices: BreakdownSlice[]
  bounds: { from: string; to: string }
  range: RangeKey
  year: number
  onRangeChange: (key: RangeKey) => void
  onYearChange: (year: number) => void
}

export function Summarize({
  total,
  previousTotal,
  rows,
  slices,
  bounds,
  range,
  year,
  onRangeChange,
  onYearChange,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? slices : slices.slice(0, COLLAPSED)
  const hidden = slices.length - shown.length
  const delta = previousTotal && previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null

  return (
    <section className={styles.card}>
      <div className={styles.chartWrap}>
        {/* Remount on range/year change so the mount animations replay. */}
        <RangeChart key={`${range}-${year}`} range={range} bounds={bounds} rows={rows} slices={slices} />
      </div>

      <div className={styles.right}>
        <div className={styles.head}>
          <p className={styles.usageLabel}>ยอดใช้จ่าย</p>
          <RangePicker value={range} year={year} onChange={onRangeChange} onYearChange={onYearChange} />
        </div>
        <p className={styles.usageTotal}>
          <RollingNumber value={total} suffix="฿" />
        </p>
        {delta !== null ? (
          <p className={styles.compare}>
            <span className={delta > 0 ? styles.up : styles.down}>
              {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
            </span>{' '}
            เทียบช่วงก่อนหน้า
          </p>
        ) : null}

        {slices.length > 0 ? (
          <>
            <div className={styles.breakdownWrap}>
              <ul key={`${range}-${year}-${expanded}`} className={styles.breakdown}>
                {shown.map((slice) => {
                  const pct = total > 0 ? (slice.value / total) * 100 : 0
                  return (
                    <li key={slice.key} className={styles.breakdownItem}>
                      <CategoryIcon icon={slice.icon ?? 'other'} color={slice.color ?? '#d9d9d9'} size={32} />
                      <span className={styles.breakdownName}>{slice.name}</span>
                      <span className={styles.breakdownPct}>{pct.toFixed(0)}%</span>
                      <span className={styles.breakdownTrack}>
                        <span
                          className={styles.breakdownFill}
                          style={{ width: `${pct}%`, background: slice.color ?? '#d9d9d9' }}
                        />
                      </span>
                      <span className={styles.breakdownValue}>{formatAmount(slice.value)}฿</span>
                      {slice.key === 'none' ? (
                        <Link
                          to="/transactions"
                          search={{
                            from: toDateKey(new Date(bounds.from)),
                            to: toDateKey(new Date(bounds.to)),
                            categoryId: '__none__',
                            sort: 'amount-desc',
                            q: '',
                          }}
                          className={styles.nudge}
                        >
                          จัดหมวด
                        </Link>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
              {hidden > 0 ? <span className={styles.breakdownFade} aria-hidden="true" /> : null}
            </div>
            {slices.length > COLLAPSED ? (
              <button type="button" className={styles.seeAll} onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'ย่อ' : `ดูทั้งหมด (${slices.length})`}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
