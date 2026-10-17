import { formatAmount } from '@/lib/utils/format'
import styles from './RollingNumber.module.css'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

// Odometer: each digit slot is a 10-digit column that rolls to its value, so a
// changed total slides into place instead of snapping. Slots are keyed by their
// distance from the end, so decimals and thousands line up as digits appear.
export function RollingNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const text = formatAmount(value) + suffix
  return (
    <span className={styles.roll} aria-label={text}>
      {text.split('').map((char, i) => {
        const place = text.length - i
        return /[0-9]/.test(char) ? (
          <span key={place} className={styles.window} aria-hidden="true">
            <span className={styles.reel} style={{ transform: `translateY(${-Number(char) * 10}%)` }}>
              {DIGITS.map((digit) => (
                <span key={digit} className={styles.digit}>
                  {digit}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span key={place} className={styles.sep} aria-hidden="true">
            {char}
          </span>
        )
      })}
    </span>
  )
}
