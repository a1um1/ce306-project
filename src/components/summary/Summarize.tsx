import { RangePicker } from './RangePicker'
import { formatAmount, type RangeKey } from '@/lib/utils/format'
import styles from './Summarize.module.css'

export type Segment = { color: string; value: number }

const SIZE = 200
const THICKNESS = 34

function Donut({ segments }: { segments: Segment[] }) {
  const center = SIZE / 2
  const radius = (SIZE - THICKNESS) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((sum, s) => sum + s.value, 0)

  let offset = 0
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s, i) => {
      const length = (s.value / total) * circumference
      const arc = (
        <circle
          key={i}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={s.color}
          strokeWidth={THICKNESS}
          strokeDasharray={`${length} ${circumference - length}`}
          strokeDashoffset={-offset}
        />
      )
      offset += length
      return arc
    })

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="สัดส่วนรายจ่ายตามหมวดหมู่">
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

type Props = {
  total: number
  segments: Segment[]
  range: RangeKey
  onRangeChange: (key: RangeKey) => void
}

export function Summarize({ total, segments, range, onRangeChange }: Props) {
  return (
    <section className={styles.card}>
      <div className={styles.chartWrap}>
        <Donut segments={segments} />
      </div>
      <div className={styles.usage}>
        <p className={styles.usageLabel}>ยอดใช้จ่าย</p>
        <p className={styles.usageTotal}>{formatAmount(total)}฿</p>
      </div>
      <RangePicker value={range} onChange={onRangeChange} />
    </section>
  )
}
