import {
  Car,
  GraduationCap,
  Shapes,
  ShoppingBag,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

export { CATEGORY_COLORS } from './palette'

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
