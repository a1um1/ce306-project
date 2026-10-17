import { useEffect, useState } from 'react'
import { CategoryIcon } from './CategoryIcon'
import { Modal } from '@/components/ui/Modal'
import { CATEGORY_COLORS, CATEGORY_ICONS, ICON_COMPONENT, ICON_LABEL } from '@/lib/utils/design'
import { createCategory, updateCategory } from '@/lib/api/categories'
import ui from '@/components/ui/ui.module.css'
import styles from '@/components/ui/dialogs.module.css'

export type CategoryRecord = { id: string; name: string; icon: string; color: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: CategoryRecord | null
  existingCount: number
  onSaved: () => void
}

export function CategoryDialog({ open, onOpenChange, initial, existingCount, onSaved }: Props) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<string>('food')
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0])
  const [nameEdited, setNameEdited] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setIcon(initial?.icon ?? 'food')
    setColor(initial?.color ?? CATEGORY_COLORS[existingCount % CATEGORY_COLORS.length])
    // An existing name counts as user-written: picking an icon must not clobber it.
    setNameEdited(Boolean(initial?.name))
    setError(null)
  }, [open, initial, existingCount])

  const chooseIcon = (next: string) => {
    setIcon(next)
    // Auto-fill the name from the icon until the user types their own.
    if (!nameEdited) setName(ICON_LABEL[next] ?? '')
  }

  const submit = async () => {
    if (!name.trim()) {
      setError('ใส่ชื่อหมวดหมู่ก่อน')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (initial) {
        await updateCategory({ data: { id: initial.id, name: name.trim(), icon, color } })
      } else {
        await createCategory({ data: { name: name.trim(), icon, color } })
      }
      onSaved()
      onOpenChange(false)
    } catch {
      setError('บันทึกไม่สำเร็จ ลองอีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={initial ? 'แก้ไขหมวดหมู่' : 'สร้างหมวดหมู่ใหม่'} width={500}>
      <div className={styles.iconRow}>
        <div className={styles.iconPreview}>
          <CategoryIcon icon={icon} color={color} />
        </div>
        <div className={ui.inputGroup}>
          <label className={ui.label} htmlFor="category-name">
            ชื่อ
          </label>
          <input
            id="category-name"
            className={ui.input}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setNameEdited(true)
            }}
            placeholder="อาหาร ค่ารถ ของใช้"
          />
        </div>
      </div>

      <div className={styles.iconPicker}>
        {CATEGORY_ICONS.map((key) => {
          const Icon = ICON_COMPONENT[key]
          return (
            <button
              key={key}
              type="button"
              className={icon === key ? styles.iconChoiceActive : styles.iconChoice}
              onClick={() => chooseIcon(key)}
              title={ICON_LABEL[key]}
            >
              <Icon size={24} strokeWidth={2} />
              <span>{ICON_LABEL[key]}</span>
            </button>
          )
        })}
      </div>

      <div className={ui.inputGroup}>
        <span className={ui.label}>สี</span>
        <div className={styles.colorPicker}>
          {CATEGORY_COLORS.map((value) => (
            <button
              key={value}
              type="button"
              className={color === value ? styles.colorSwatchActive : styles.colorSwatch}
              style={{ background: value }}
              onClick={() => setColor(value)}
              aria-label={`เลือกสี ${value}`}
            />
          ))}
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <button type="button" className={ui.primary} onClick={submit} disabled={busy}>
        {busy ? 'กำลังบันทึก…' : 'บันทึก'}
      </button>
    </Modal>
  )
}
