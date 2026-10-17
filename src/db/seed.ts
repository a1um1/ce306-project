import 'dotenv/config'
import { pathToFileURL } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { merchantCore } from '../lib/utils/categorize.ts'
import { category, merchantRule } from './schema.ts'

// Built-in categories: user_id IS NULL, shared by everyone, not editable.
// Keep in sync with CATEGORY_ICONS in lib/utils/design.ts. Order here is the
// display order (created_at is derived from the index).
const CATEGORIES = [
  { id: 'builtin-food', name: 'อาหาร', icon: 'food', color: '#FF8D7F' },
  { id: 'builtin-transport', name: 'เดินทาง', icon: 'transport', color: '#D995FF' },
  { id: 'builtin-shopping', name: 'ช้อปปิ้ง', icon: 'shopping', color: '#00D89E' },
  { id: 'builtin-school', name: 'ค่าเล่าเรียน', icon: 'school', color: '#00CCFF' },
  { id: 'builtin-home', name: 'ที่พัก', icon: 'home', color: '#F6A300' },
  { id: 'builtin-health', name: 'สุขภาพ', icon: 'health', color: '#7FC4FF' },
  { id: 'builtin-fun', name: 'บันเทิง', icon: 'fun', color: '#B0E57C' },
  { id: 'builtin-bills', name: 'บิล', icon: 'bills', color: '#FFD166' },
  { id: 'builtin-phone', name: 'มือถือ/เน็ต', icon: 'phone', color: '#FF9FF3' },
  { id: 'builtin-personal', name: 'ของใช้ส่วนตัว', icon: 'personal', color: '#C9B6FF' },
  { id: 'builtin-family', name: 'ครอบครัว', icon: 'family', color: '#FF8D7F' },
  { id: 'builtin-gift', name: 'ของขวัญ', icon: 'gift', color: '#D995FF' },
  { id: 'builtin-donation', name: 'ทำบุญ', icon: 'donation', color: '#00D89E' },
  { id: 'builtin-pet', name: 'สัตว์เลี้ยง', icon: 'pet', color: '#00CCFF' },
  { id: 'builtin-travel', name: 'ท่องเที่ยว', icon: 'travel', color: '#F6A300' },
  { id: 'builtin-insurance', name: 'ประกัน', icon: 'insurance', color: '#7FC4FF' },
  { id: 'builtin-investment', name: 'ลงทุน/ออม', icon: 'investment', color: '#B0E57C' },
  { id: 'builtin-fees', name: 'ค่าธรรมเนียม', icon: 'fees', color: '#FFD166' },
  { id: 'builtin-services', name: 'บริการ', icon: 'services', color: '#C9B6FF' },
  { id: 'builtin-tax', name: 'ภาษี', icon: 'tax', color: '#FF8D7F' },
  { id: 'builtin-household', name: 'ของใช้ในบ้าน', icon: 'household', color: '#D995FF' },
  { id: 'builtin-delivery', name: 'ค่าส่ง/พัสดุ', icon: 'delivery', color: '#00D89E' },
  { id: 'builtin-laundry', name: 'ซักผ้า', icon: 'laundry', color: '#00CCFF' },
  { id: 'builtin-beauty', name: 'ความงาม', icon: 'beauty', color: '#FF9FF3' },
  { id: 'builtin-sports', name: 'กีฬา', icon: 'sports', color: '#F6A300' },
  { id: 'builtin-loan', name: 'เงินกู้/ผ่อน', icon: 'loan', color: '#7FC4FF' },
  { id: 'builtin-drinks', name: 'เครื่องดื่ม', icon: 'drinks', color: '#B0E57C' },
  { id: 'builtin-other', name: 'อื่น ๆ', icon: 'other', color: '#C9B6FF' },
]

// Seed merchant memory. The key is merchantCore(raw slip title), so a brand
// recurs under one identity ("TrueMoney Wallet" == "TRUE MONEY COMPANY LIMITED
// <ref>"). Only clearly-branded merchants are seeded; unknown people stay NULL.
const MERCHANT_SEEDS: [string, string][] = [
  ['TRUE MONEY COMPANY LIMITED', 'builtin-other'],
  ['GrabPay Wallet', 'builtin-other'],
  ['ร้านเวนดิ้งบายบุญเติม บมจ. ฟอร์ท สมาร์ท เซอร์วิส', 'builtin-other'],
  ['SHOPEEPAY WALLET', 'builtin-shopping'],
  ['THE MALL GROUP CO.,LTD.BR00011', 'builtin-shopping'],
  ['CP AXTRA PUBLIC COMPANY LIMITED (HEAD', 'builtin-shopping'],
  ['กรุงศรี มั่งมี ช้อป (โซห่วย)', 'builtin-shopping'],
  ['กรุงศรีมั่งมีช้อป(โชห่วย)', 'builtin-shopping'],
  ['กรุงศรี มั่งมี ช้อป (ป้ากาญจน์)', 'builtin-shopping'],
  ['พระราม2 บมจ. บิ๊กซี ซูเปอร์เซ็นเตอร์', 'builtin-shopping'],
  ['พันธุ์ทิพย์ งามวงศ์วาน บมจ. บิ๊กซี ซูเปอร์เซ็นเตอร์', 'builtin-shopping'],
  ['บริษัท ช้อปปี้เพย์ (ประเทศไทย) จำกัด บจก. ช้อปปี้เพย์ (ประเทศไทย)', 'builtin-shopping'],
  ['QR Payment at BTS บจก. บางกอก สมาร์ทการ์ด ซิสเทม', 'builtin-transport'],
  ['QR PAYMENT AT BTS TIM01005220827172852', 'builtin-transport'],
  ['ดีแทคเติมเงิน dtac', 'builtin-phone'],
  ['เอไอเอส วัน-ทู-คอล! AIS', 'builtin-phone'],
  ['อเมซอน-คงพนม 61 บจก. คงพนม 61', 'builtin-food'],
  ['ฟู้ด ปาร์ด บจก. เซ็นทรัลเวิลด์', 'builtin-food'],
  ['Food Court-T21 Rama', 'builtin-food'],
  ['คอ คาเฟ่ น.ส. นิศารัตน์ มัธยัสถ์ถาวร', 'builtin-food'],
  ['ลอว์สัน-P3713 สถาบันเทคโนโลยี พระจอมเกล้าเจ้าคุณทหา บจก. สห ลอว์สัน', 'builtin-food'],
  ['นิติบุคคลอาคารชุด แชปเตอร์วัน โมเดิร์นดั', 'builtin-home'],
  ['บจก. อินเตอร์ เรสซิเดนซ์ เซอร์วิส', 'builtin-home'],
  ['บจก. เดอะ เฟลิกซ์ พร็อพเพอร์ตี้', 'builtin-home'],
]

export async function seed() {
  const client = postgres(process.env.DATABASE_URL!)
  const db = drizzle(client, { schema: { category, merchantRule } })
  const at = new Date('2026-01-01T00:00:00Z')

  try {
    for (const [index, c] of CATEGORIES.entries()) {
      // Distinct created_at per index keeps the listing order stable.
      const createdAt = new Date(at.getTime() + index * 1000)
      await db
        .insert(category)
        .values({ ...c, userId: null, createdAt, updatedAt: createdAt })
        .onConflictDoUpdate({
          target: category.id,
          set: { name: c.name, icon: c.icon, color: c.color, createdAt, updatedAt: createdAt },
        })
    }

    for (const [index, [raw, categoryId]] of MERCHANT_SEEDS.entries()) {
      const key = merchantCore(raw)
      if (!key) continue
      await db
        .insert(merchantRule)
        // Fixed id: the (user_id, key) unique index treats NULLs as distinct,
        // so it cannot dedupe seeds. The primary key can.
        .values({ id: `seed-${String(index + 1).padStart(2, '0')}`, userId: null, key, categoryId, createdAt: at, updatedAt: at })
        .onConflictDoUpdate({ target: merchantRule.id, set: { key, categoryId, updatedAt: at } })
    }
  } finally {
    await client.end()
  }

  return { categories: CATEGORIES.length, rules: MERCHANT_SEEDS.length }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await seed()
  console.log(`seeded ${result.categories} categories, ${result.rules} merchant rules`)
}
