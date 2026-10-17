import {
  Car,
  GraduationCap,
  Shapes,
  ShoppingBag,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

export const CATEGORY_COLORS = ['#FF8D7F', '#D995FF', '#00D89E', '#00CCFF', '#F6A300'] as const

export const CATEGORY_ICONS = ['food', 'transport', 'shopping', 'school', 'other'] as const
export type CategoryIconName = (typeof CATEGORY_ICONS)[number]

export const ICON_COMPONENT: Record<string, LucideIcon> = {
  food: Utensils,
  transport: Car,
  shopping: ShoppingBag,
  school: GraduationCap,
  other: Shapes,
}

export const ICON_LABEL: Record<string, string> = {
  food: 'อาหาร',
  transport: 'ค่ารถ',
  shopping: 'ช็อปปิ้ง',
  school: 'ค่าเล่าเรียน',
  other: 'อื่น ๆ',
}
