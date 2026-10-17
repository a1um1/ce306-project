import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './Modal.module.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  width?: number
  /** When false, only the close button dismisses: outside press and Escape are ignored. */
  dismissible?: boolean
}

export function Modal({ open, onOpenChange, title, children, width = 560, dismissible = true }: Props) {
  return (
    <Dialog.Root
      open={open}
      disablePointerDismissal={!dismissible}
      onOpenChange={(next, event) => {
        if (!dismissible && !next && (event.reason === 'outside-press' || event.reason === 'escape-key')) {
          return
        }
        onOpenChange(next)
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.popup} style={{ width }}>
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            <Dialog.Close className={styles.close} aria-label="ปิด">
              <X size={24} strokeWidth={2} />
            </Dialog.Close>
          </div>
          <div className={styles.body}>{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
