import { useEffect, useRef, useState, type MouseEvent } from 'react'
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

type ShowFn = (event: MouseEvent, title: string, value: string) => void
type Hover = { x: number; y: number; title: string; value: string }

function Donut({ slices, show }: { slices: BreakdownSlice[]; show: ShowFn }) {
  const center = SIZE / 2
  const radius = (SIZE - THICKNESS) / 2
  const circumference = 2 * Math.PI * radius
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  // Start collapsed, then grow on the next frame so CSS can transition the sweep.
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  let offset = 0
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s, i) => {
      const length = (s.value / total) * circumference
      const value = `${formatAmount(s.value)}฿ · ${((s.value / total) * 100).toFixed(0)}%`
      const arc = (
        <circle
          key={s.key}
          className={styles.arc}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={s.color ?? '#d9d9d9'}
          strokeWidth={THICKNESS}
          strokeDasharray={grown ? `${length} ${circumference - length}` : `0 ${circumference}`}
          strokeDashoffset={-offset}
          style={{ transitionDelay: `${i * 60}ms` }}
          onMouseEnter={(e) => show(e, s.name, value)}
          onMouseMove={(e) => show(e, s.name, value)}
          onClick={(e) => show(e, s.name, value)}
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

function Bars({
  buckets,
  label,
  dense = false,
  highlight = -1,
  show,
}: {
  buckets: Bucket[]
  label: string
  dense?: boolean
  highlight?: number
  show: ShowFn
}) {
  const max = Math.max(...buckets.map((b) => b.value), 1)
  return (
    <div className={styles.barsWrap} role="img" aria-label={label}>
      <span className={styles.barsMax}>สูงสุด {formatAmount(max)}฿</span>
      <div className={dense ? `${styles.bars} ${styles.barsDense}` : styles.bars}>
        {buckets.map((bucket, i) => {
          const title = bucket.label
          const value = `${formatAmount(bucket.value)}฿`
          return (
            <div
              key={i}
              className={styles.barCol}
              onMouseEnter={(e) => show(e, title, value)}
              onMouseMove={(e) => show(e, title, value)}
              onClick={(e) => show(e, title, value)}
            >
              <div className={styles.barSlot}>
                <div
                  className={i === highlight ? `${styles.bar} ${styles.barCurrent}` : styles.bar}
                  style={{ height: `${(bucket.value / max) * 100}%` }}
                />
              </div>
              {/* Keep an empty label so bars stay aligned; dense shows only the ends. */}
              <span className={styles.barLabel}>
                {!dense || i === 0 || i === buckets.length - 1 ? bucket.label : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Calendar({
  days,
  month,
  totals,
  label,
  show,
}: {
  days: Date[]
  month: number
  totals: Map<string, number>
  label: string
  show: ShowFn
}) {
  const values = days.map((day) => totals.get(toDateKey(day)) ?? 0)
  const max = Math.max(...values, 1)
  return (
    <div className={styles.calendar}>
      <span className={styles.calendarLabel}>{label}</span>
      <div className={styles.calendarHead} aria-hidden="true">
        {WEEKDAYS.map((day, i) => (
          <span key={i} className={styles.calendarWeekday}>
            {day}
          </span>
        ))}
      </div>
      <div className={styles.calendarGrid} role="img" aria-label={label}>
        {days.map((day, i) => {
          const title = `${day.getDate()} ${THAI_MONTHS[day.getMonth()]}`
          const value = `${formatAmount(values[i])}฿`
          const outside = day.getMonth() !== month
          return (
            <span
              key={i}
              className={outside ? styles.dotOutside : styles.dot}
              style={
                outside
                  ? undefined
                  : { opacity: values[i] === 0 ? 0.15 : 0.35 + 0.65 * (values[i] / max) }
              }
              onMouseEnter={(e) => show(e, title, value)}
              onMouseMove={(e) => show(e, title, value)}
              onClick={(e) => show(e, title, value)}
            />
          )
        })}
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
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<Hover | null>(null)

  // Chart-local coords, so the tooltip follows the pointer inside the wrap.
  const show: ShowFn = (event, title, value) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    setHover({ x: event.clientX - rect.left, y: event.clientY - rect.top, title, value })
  }

  let chart
  if (range === 'today') {
    chart = <Donut slices={slices} show={show} />
  } else if (range === 'week') {
    const totals = dailyTotals(rows)
    const days = weekDays(anchor)
    const todayKey = toDateKey(new Date())
    chart = (
      <Bars
        label="รายจ่ายรายวันในสัปดาห์นี้"
        show={show}
        highlight={days.findIndex((day) => toDateKey(day) === todayKey)}
        buckets={days.map((day) => ({
          label: WEEKDAYS[day.getDay()],
          value: totals.get(toDateKey(day)) ?? 0,
        }))}
      />
    )
  } else if (range === 'month') {
    chart = (
      <Calendar
        days={calendarDays(anchor.getFullYear(), anchor.getMonth())}
        month={anchor.getMonth()}
        totals={dailyTotals(rows)}
        label={`${THAI_MONTHS[anchor.getMonth()]} ${anchor.getFullYear() + 543}`}
        show={show}
      />
    )
  } else {
    // lastMonths ends on the given month, so anchor on the range end: for a full
    // year that is Dec -> Jan..Dec, for half a year it is the current month.
    const last = new Date(bounds.to)
    const months = range === 'year' ? 12 : 6
    const totals = monthlyTotals(rows)
    const buckets = lastMonths(last, months).map((month) => ({
      label: THAI_MONTHS[month.getMonth()],
      value: totals.get(monthKey(month)) ?? 0,
    }))
    chart = (
      <Bars
        label={
          range === 'year'
            ? `รายจ่ายรายเดือนปี ${last.getFullYear() + 543}`
            : 'รายจ่ายรายเดือนย้อนหลัง 6 เดือน'
        }
        dense={range === 'year'}
        show={show}
        highlight={buckets.length - 1}
        buckets={buckets}
      />
    )
  }

  return (
    <div ref={wrapRef} className={styles.chart} onMouseLeave={() => setHover(null)}>
      {chart}
      {hover ? (
        <div className={styles.tooltip} style={{ left: hover.x, top: hover.y }} role="tooltip">
          <span className={styles.tooltipTitle}>{hover.title}</span>
          <span className={styles.tooltipValue}>{hover.value}</span>
        </div>
      ) : null}
    </div>
  )
}
