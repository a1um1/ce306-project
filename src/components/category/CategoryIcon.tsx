import { ICON_COMPONENT } from '@/lib/utils/design'

type Props = { icon: string; color: string; size?: number }

export function CategoryIcon({ icon, color, size = 48 }: Props) {
  const Icon = ICON_COMPONENT[icon] ?? ICON_COMPONENT.other
  return (
    <span
      style={{
        background: color,
        width: size,
        height: size,
        borderRadius: 100,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
      }}
    >
      <Icon size={size / 2} color="#fff" strokeWidth={2} />
    </span>
  )
}
