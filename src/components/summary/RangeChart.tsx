import { THAI_MONTHS, formatAmount, toDateKey, type RangeKey } from '@/lib/utils/format'
import {
  calendarDays,
  dailyTotals,
  lastMonths,
  monthKey,
  monthlyTotals,
  weekDays,
  type BreakdownSlice,
  type Bucket,
  type SummaryRow,
} from '@/lib/utils/summary'
import styles from './Summarize.module.css'

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const SIZE = 200
const THICKNESS = 34

function Donut({ slices }: { slices: BreakdownSlice[] }) {
  const center = SIZE / 2
  const radius = (SIZE - THICKNESS) / 2
  const circumference = 2 * Math.PI * radius
  const total = slices.reduce((sum, s) => sum + s.value, 0)

  let offset = 0
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const length = (s.value / total) * circumference
      const arc = (
        <circle
          key={s.key}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={s.color ?? '#d9d9d9'}
          strokeWidth={THICKNESS}
          strokeDasharray={`${length} ${circumference - length}`}
          strokeDashoffset={-offset}
        />
      )
      offset += length
      return arc
    })

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label="สัดส่วนรายจ่ายตามหมวดหมู่"
    >
      <g transform={`rotate(-90 ${center} ${center})`}>
        {total === 0 ? (
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#e9e9e9" strokeWidth={THICKNESS} />
        ) : (
          arcs
        )}
      </g>
    </svg>
  )
}

function Bars({ buckets, label, dense = false }: { buckets: Bucket[]; label: string; dense?: boolean }) {
  const max = Math.max(...buckets.map((b) => b.value), 1)
  return (
    <div className={dense ? `${styles.bars} ${styles.barsDense}` : styles.bars} role="img" aria-label={label}>
      {buckets.map((bucket, i) => (
        <div key={i} className={styles.barCol} title={`${bucket.label} ${formatAmount(bucket.value)}฿`}>
          <div className={styles.barSlot}>
            <div className={styles.bar} style={{ height: `${(bucket.value / max) * 100}%` }} />
          </div>
          {/* Keep an empty label so bars stay aligned; dense shows only the ends. */}
          <span className={styles.barLabel}>
            {!dense || i === 0 || i === buckets.length - 1 ? bucket.label : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

function Calendar({
  days,
  totals,
  label,
}: {
  days: Date[]
  totals: Map<string, number>
  label: string
}) {
  const values = days.map((day) => totals.get(toDateKey(day)) ?? 0)
  const max = Math.max(...values, 1)
  return (
    <div className={styles.calendar}>
      <span className={styles.calendarLabel}>{label}</span>
      <div className={styles.calendarGrid} role="img" aria-label={label}>
        {days.map((day, i) => (
          <span
            key={i}
            className={styles.dot}
            style={{ opacity: values[i] === 0 ? 0.15 : 0.35 + 0.65 * (values[i] / max) }}
            title={`${day.getDate()} ${THAI_MONTHS[day.getMonth()]} · ${formatAmount(values[i])}฿`}
          />
        ))}
      </div>
    </div>
  )
}

type Props = {
  range: RangeKey
  bounds: { from: string; to: string }
  rows: SummaryRow[]
  slices: BreakdownSlice[]
}

// The range decides the shape: a share donut for one day, per-day bars for the
// week, a calendar heat map for the month, per-month bars for half a year.
export function RangeChart({ range, bounds, rows, slices }: Props) {
  const anchor = new Date(bounds.from)

  if (range === 'today') return <Donut slices={slices} />

  if (range === 'week') {
    const totals = dailyTotals(rows)
    return (
      <Bars
        label="รายจ่ายรายวันในสัปดาห์นี้"
        buckets={weekDays(anchor).map((day) => ({
          label: WEEKDAYS[day.getDay()],
          value: totals.get(toDateKey(day)) ?? 0,
        }))}
      />
    )
  }

  if (range === 'month') {
    return (
      <Calendar
        days={calendarDays(anchor.getFullYear(), anchor.getMonth())}
        totals={dailyTotals(rows)}
        label={`${THAI_MONTHS[anchor.getMonth()]} ${anchor.getFullYear() + 543}`}
      />
    )
  }

  // lastMonths ends on the given month, so anchor on the range end: for a full
  // year that is Dec -> Jan..Dec, for half a year it is the current month.
  const last = new Date(bounds.to)
  const months = range === 'year' ? 12 : 6
  const totals = monthlyTotals(rows)
  return (
    <Bars
      label={
        range === 'year'
          ? `รายจ่ายรายเดือนปี ${last.getFullYear() + 543}`
          : 'รายจ่ายรายเดือนย้อนหลัง 6 เดือน'
      }
      dense={range === 'year'}
      buckets={lastMonths(last, months).map((month) => ({
        label: THAI_MONTHS[month.getMonth()],
        value: totals.get(monthKey(month)) ?? 0,
      }))}
    />
  )
}
