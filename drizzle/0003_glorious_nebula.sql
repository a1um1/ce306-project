ALTER TABLE "category" ALTER COLUMN "user_id" DROP NOT NULL;
-- Built-in categories: user_id IS NULL, shared by every user, not editable.
-- created_at is fixed so the listing order is stable and built-ins stay first.
INSERT INTO "category" ("id", "user_id", "name", "icon", "color", "created_at", "updated_at") VALUES
  ('builtin-food',      NULL, 'อาหาร',        'food',     '#FF8D7F', '2026-01-01 00:00:01+00', '2026-01-01 00:00:01+00'),
  ('builtin-transport', NULL, 'เดินทาง',       'transport','#D995FF', '2026-01-01 00:00:02+00', '2026-01-01 00:00:02+00'),
  ('builtin-shopping',  NULL, 'ช้อปปิ้ง',      'shopping', '#00D89E', '2026-01-01 00:00:03+00', '2026-01-01 00:00:03+00'),
  ('builtin-school',    NULL, 'ค่าเล่าเรียน',  'school',   '#00CCFF', '2026-01-01 00:00:04+00', '2026-01-01 00:00:04+00'),
  ('builtin-home',      NULL, 'ที่พัก',        'home',     '#F6A300', '2026-01-01 00:00:05+00', '2026-01-01 00:00:05+00'),
  ('builtin-health',    NULL, 'สุขภาพ',        'health',   '#7FC4FF', '2026-01-01 00:00:06+00', '2026-01-01 00:00:06+00'),
  ('builtin-fun',       NULL, 'บันเทิง',       'fun',      '#B0E57C', '2026-01-01 00:00:07+00', '2026-01-01 00:00:07+00'),
  ('builtin-bills',     NULL, 'บิล',           'bills',    '#FFD166', '2026-01-01 00:00:08+00', '2026-01-01 00:00:08+00'),
  ('builtin-phone',     NULL, 'มือถือ/เน็ต',   'phone',    '#FF9FF3', '2026-01-01 00:00:09+00', '2026-01-01 00:00:09+00'),
  ('builtin-personal',  NULL, 'ของใช้ส่วนตัว', 'personal', '#C9B6FF', '2026-01-01 00:00:10+00', '2026-01-01 00:00:10+00'),
  ('builtin-family',    NULL, 'ครอบครัว',      'family',   '#FF8D7F', '2026-01-01 00:00:11+00', '2026-01-01 00:00:11+00'),
  ('builtin-gift',      NULL, 'ของขวัญ',       'gift',     '#D995FF', '2026-01-01 00:00:12+00', '2026-01-01 00:00:12+00'),
  ('builtin-donation',  NULL, 'ทำบุญ',         'donation', '#00D89E', '2026-01-01 00:00:13+00', '2026-01-01 00:00:13+00'),
  ('builtin-pet',       NULL, 'สัตว์เลี้ยง',   'pet',      '#00CCFF', '2026-01-01 00:00:14+00', '2026-01-01 00:00:14+00'),
  ('builtin-travel',    NULL, 'ท่องเที่ยว',    'travel',   '#F6A300', '2026-01-01 00:00:15+00', '2026-01-01 00:00:15+00'),
  ('builtin-other',     NULL, 'อื่น ๆ',        'other',    '#C9B6FF', '2026-01-01 00:00:16+00', '2026-01-01 00:00:16+00');
